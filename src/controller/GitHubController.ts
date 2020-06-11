import {Config, ConfigKey} from "../Config";
import {IAuthorStatistics, ICommit, IContributorStatistics, IIssue, IRepo, IShortCommit} from "../Types";
import axios from "axios";

export default class GitHubController {
	/**
	 * Lists all the repos in an organisation.
	 * The default org is set in an environment variable, but can be overridden with the org param
	 * @param match if this is present, only repos whose name pass the match regex test will be returned
	 * @param org the organisation from which to list repos
	 */
	public async listRepos(match?: RegExp, org?: string): Promise<IRepo[]> {
		org = org || Config.getInstance().get(ConfigKey.defaultOrg);
		let repos = [], data, i = 1;
		do {
			data = await GitHubController.get(`/orgs/${org}/repos`, {per_page: 100, page: i++});
			repos = repos.concat(data);
		} while (data.length > 0);
		repos = repos.map(repo => ({name: repo.name, url: repo.html_url, fullName: repo.full_name}));
		if (match) {
			repos = repos.filter(repo => match.test(repo.name));
		}
		return repos;
	}

	/**
	 * Gets the approximate stats on a repo like from the Insights tab of a GitHub repo
	 * Statistics are from around the last two months
	 * Statistics ONLY apply to GitHub Enterprise users.
	 * 		If an Author is pushing from an username not recognized by the Enterprise account
	 * 		they will be omitted
	 * This is the fastest way to get a large amount decent of data
	 * @param repo the repo to examine
	 */
	public async getStatistics(repo: IRepo): Promise<IContributorStatistics[]> {
		const endpoint = `/repos/${repo.fullName}/stats/contributors`;
		const contributors = await GitHubController.get(endpoint);
		return contributors.map(contributor => ({
			id: contributor.author.login,
			numCommits: contributor.total,
			history: contributor.weeks.map(week => ({
				additions: week.a,
				deletions: week.d,
				commits: week.c,
				unixWeekRangeStart: Number(week.w),
				humanWeekRangeStart: new Date(Number(week.w) * 1000).toLocaleString(),
			}))
		}));
	}

	/**
	 * List of all commits (sha and author email) in a repo
	 * @param repo
	 * @param since
	 * @param until
	 */
	public async getCommits(repo: IRepo, since?: string, until?: string): Promise<IShortCommit[]> {
		since = since ? new Date(since).toISOString() : since;
		until = until ? new Date(until).toISOString() : until;

		const endpoint = `/repos/${repo.fullName}/commits`;
		let commits = [], data, i = 1;
		do {
			data = await GitHubController.get(endpoint, {per_page: 100, page: i++, since, until});
			commits = commits.concat(data);
		} while (data.length > 0);
		return commits.map(commit => ({
			sha: commit.sha,
			authorEmail: commit.commit.author.email,
			date: commit.commit.author.date,
			githubId: commit.author ? commit.author.login : commit.commit.author.name
		}));
	}

	/**
	 * Gets details on a single commit (every file changed and their additions/deletions)
	 * @param repo Repo to which the commit belongs
	 * @param commit The commit object onto which data will be appended
	 */
	public async getCommitDetails(repo: IRepo, commit: IShortCommit): Promise<ICommit> {
		const endpoint = `/repos/${repo.fullName}/commits/${commit.sha}`;
		const response = await GitHubController.get(endpoint);
		return {
			...commit,
			files: response.files.map(file => ({
				name: file.filename,
				additions: file.additions,
				deletions: file.deletions,
				status: file.status,
			}))
		};
	}

	public async createIssue(repo: IRepo, issue: IIssue): Promise<boolean> {
		const endpoint = `/repos/${repo.fullName}/issues`;
		try {
			await GitHubController.post(endpoint, issue);
			return true;
		} catch (err) {
			return false;
		}
	}

	public getAuthorsSince(repo: IRepo, since: string, match?: RegExp) {
		return this._getAuthors(repo, since, undefined, match);
	}

	public getAuthorsUntil(repo: IRepo, until: string, match?: RegExp) {
		return this._getAuthors(repo, undefined, until, match);
	}

	public getAuthorsBetween(repo: IRepo, since: string, until: string, match?: RegExp) {
		return this._getAuthors(repo, undefined, until, match);
	}

	public getAuthors(repo: IRepo, match?: RegExp) {
		return this._getAuthors(repo, undefined, undefined, match);
	}

	/**
	 * Gets all authors in a repo and their contributions
	 * @param repo The repo to inspect
	 * @param since Date to start looking at commits
	 * @param until Date to stop looking at commits
	 * @param match If match is present, only file changes where the filename matches match will be counted
	 */
	private async _getAuthors(repo: IRepo, since?: string, until?: string, match?: RegExp): Promise<IAuthorStatistics[]> {
		const shortCommits: IShortCommit[] = await this.getCommits(repo, since, until);
		const promises = shortCommits.map(commit => this.getCommitDetails(repo, commit));
		const commits = await Promise.all(promises);

		const contributors = {};
		for (const commit of commits) {
			if (!contributors[commit.authorEmail]) {
				contributors[commit.authorEmail] = {
					id: commit.authorEmail,
					numCommits: 0,
					additions: 0,
					deletions: 0,
				}
			}
			contributors[commit.authorEmail].numCommits++;
			for (const file of commit.files) {
				if (!match || match.test(file.name)) {
					contributors[commit.authorEmail].additions += file.additions;
					contributors[commit.authorEmail].deletions += file.deletions;
				}
			}
		}

		return Object.values(contributors);
	}

	private static async get(endpoint: string, params?: any): Promise<any> {
		const cf: Config = Config.getInstance();
		const response = await axios.get(`${cf.get(ConfigKey.gitHubHostName)}/api/v3${endpoint}`,
			{headers: {Authorization: `token ${cf.get(ConfigKey.apiKey)}`}, params});
		if (response.status === 200) {
			return response.data;
		} else if (response.status === 202) {
			// Waiting and trying again as GitHub will return 202 if the data exists,
			// but can't return it yet
			// https://developer.github.com/v3/repos/statistics/#a-word-about-caching
			await this.sleep(1);
			return this.get(endpoint, params);
		}
		throw new Error("Failed to retrieve data!");
	}

	private static async post(endpoint: string, data: any, params?: any): Promise<any> {
		const cf: Config = Config.getInstance();
		const response = await axios.post(`${cf.get(ConfigKey.gitHubHostName)}/api/v3${endpoint}`, data,
			{headers: {Authorization: `token ${cf.get(ConfigKey.apiKey)}`}, params});
		if (response.status === 201) {
			return response.data;
		} else {
			throw new Error("Failed to post data!");
		}
	}

	private static sleep(seconds: number): Promise<void> {
		return new Promise(resolve => setTimeout(() => resolve(), seconds * 1000));
	}
}
