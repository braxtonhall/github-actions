import * as dotenv from 'dotenv';
dotenv.config({path: "./.env"});

export enum ConfigKey {
	gitHubHostName = "gitHubHostName",
	defaultOrg = "defaultOrg",
	apiKey = "apiKey",
}

export class Config {
	private static instance: Config = null;

	public static getInstance(): Config {
		if (!Config.instance) {
			Config.instance = new Config();
		}
		return Config.instance;
	}

	private readonly config: {[key: string]: any};

	private constructor() {
		this.config = {
			[ConfigKey.gitHubHostName]: process.env.GITHUB_HOST,
			[ConfigKey.defaultOrg]:     process.env.DEFAULT_ORG,
			[ConfigKey.apiKey]:         process.env.API_KEY,
		};
	}

	public get(key: ConfigKey): any {
		if (this.config[key] !== null && this.config[key] !== undefined) {
			return this.config[key];
		} else {
			console.warn(`Config Key "${key}" was not set, yet accessed.`);
			return null;
		}
	}
}