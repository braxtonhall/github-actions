import GitHubController from "./controller/GitHubController";
import * as fs from "fs-extra";

// This is a sample file. Just meant to show you how you might use the project
(async () => {
	// Make a controller
	const ghc = new GitHubController();
	// Get every repo
	const repos = await ghc.listRepos(/^project_team/);
	// For each repo, get all the Authors, but only count contributions for files that end in .ts
	const promises = repos.map(repo => (async() => ({name: repo.name, stats: await ghc.getAuthors(repo, /\.ts$/)}))());
	const stats = await Promise.all(promises);
	
	const date = new Date();
	const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDay()];
	await fs.outputFile(`./runs/${year}${month}${day}.json`, JSON.stringify(stats, null, "    "));
	console.log("Done!");
})();