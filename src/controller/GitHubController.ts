import {Config, ConfigKey} from "../Config";
import {IAuthorStatistics, ICommit, IContributorStatistics, IRepo, IShortCommit} from "../Types";
import axios from "axios";

export default class GitHubController {
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
	
	public async getCommits(repo: IRepo): Promise<IShortCommit[]> {
		const endpoint = `/repos/${repo.fullName}/commits`;
		let commits = [], data, i = 1;
		do {
			data = await GitHubController.get(endpoint, {per_page: 100, page: i++});
			commits = commits.concat(data);
		} while (data.length > 0);
		return commits.map(commit => ({
			sha: commit.sha,
			authorEmail: commit.commit.author.email,
		}));
	}
	
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
	
	public async getAuthors(repo: IRepo, match?: RegExp): Promise<IAuthorStatistics[]> {
		const shortCommits: IShortCommit[] = await this.getCommits(repo);
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
		try {
			const response = await axios.get(`${cf.get(ConfigKey.gitHubHostName)}/api/v3${endpoint}`,
				{headers: {Authorization: `token ${cf.get(ConfigKey.apiKey)}`}, params});
			if (response.status === 200) {
				return response.data;
			} else if (response.status === 202) {
				await this.sleep(1);
				return this.get(endpoint, params);
			}
		} catch (err) {
			// suppress
			console.error(err);
		}
		throw new Error("Failed to retrieve data!");
	}
	
	private static sleep(seconds: number): Promise<void> {
		return new Promise(resolve => setTimeout(() => resolve(), seconds * 1000));
	}
}
