const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
    const githubToken = core.getInput('githubToken');
    const octokit = github.getOctokit(githubToken)

    const tags = octokit.repos.listTags({
        ...github.context.repo
    });

    console.log(tags);
}

run();
