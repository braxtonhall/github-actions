export interface IRepo {
	name: string;
	url: string;
	fullName: string;
}

export interface IStatistics {
	id: string;
	numCommits: number;
}

export interface IContributorStatistics extends IStatistics {
	history: IActivity[];
}

export interface IAuthorStatistics extends IStatistics {
	additions: number;
	deletions: number;
}

export interface IActivity {
	additions: number;
	deletions: number;
	commits: number;
	humanWeekRangeStart: string;
	unixWeekRangeStart: number;
}

export interface IShortCommit {
	sha: string;
	authorEmail: string;
	date: string;
	githubId: string;
}

export interface ICommit extends IShortCommit {
	files: IFile[];
}

export interface IFile {
	name: string;
	additions: number;
	deletions: number;
	status: string;
}

export interface IIssue {
	title: string;
	body: string;
	assignees?: string[];
	milestone?: number;
	labels?: string[];
}
