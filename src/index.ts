import GitHubController from "./controller/GitHubController";
import * as fs from "fs-extra";

// This is a sample file. Just meant to show you how you might use the project
const example1 = async () => {
	// Make a controller
	const ghc = new GitHubController();
	
	// EXAMPLE 1 making a .json file with the contribution distribution of every author on every
	//           team in the default org, with repos whose name matches /^project_team/
	// Get every repo
	const repos = await ghc.listRepos(/^project_team/);
	// For each repo, get all the Authors, but only count contributions for files that end in .ts
	let promises: any = repos.map(repo => (async() => ({name: repo.name, stats: await ghc.getAuthors(repo, /\.ts$/)}))());
	const stats = await Promise.all(promises);

	// Saving
	let date = new Date();
	let [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDay()];
	await fs.outputFile(`./runs/${year}${month}${day}.json`, JSON.stringify(stats, null, "    "));
	console.log("Done!");
};

const example2 = async() => {
	// Make a controller
	const ghc = new GitHubController();

	// EXAMPLE 2 making a .csv file with the author emails for each team in the org
	const repos = await ghc.listRepos(/^project_team/);
	const commits = await Promise.all(repos.map(repo => (async() => ({
		name: repo.name,
		commits: await ghc.getCommits(repo, "October 8 2019", "October 29 2019")
	}))()));

	// Saving
	let date = new Date();
	let [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDay()];
	await Promise.all(commits.map((commit: any) => fs.outputFile(
		`./runs/${year}${month}${day}/${commit.name}.csv`,
		"SHA,DATE,ID,EMAIL\n" + commit.commits.map(c => `${c.sha},${c.date},${c.githubId},${c.authorEmail}`).join("\n"))
	));
	console.log("Done!");
};

example2();