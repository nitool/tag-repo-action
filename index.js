const core = require('@actions/core');
const github = require('@actions/github');
const Webhooks = require('@octokit/webhooks');

const cleanupVersion = version => version.replace(/[_\-\/]/g, '.')
const decomposeVersion = version => {
    const matches = version.match(/(\d+)[.](\d+)[.](\d+)/);
    if (matches === null) {
        throw new Error('Unsupported version');
    }

    return {
        major: parseInt(matches[1]),
        minor: parseInt(matches[2]),
        patch: parseInt(matches[3]),
    }
}

const specifyPart = (branch, target) => {
    if (['master', 'develop'].indexOf(branch) !== -1) {
        throw new Error('version cannot be incremented for given branches');
    } else if (target !== 'master') {
        throw new Error('target branch is not master, version will not be incremented');
    }

    const flowMatch = branch.match(/^(\w+)\/.*?$/);
    if (flowMatch === null) {
        throw new Error('given branch is not valid git flow branch');
    }

    if (flowMatch[1] === 'release') {
        return 'minor';
    } else if (flowMatch[1] === 'hotfix') {
        return 'patch';
    }

    throw new Error('unsupported part');
}

const incrementPart = (part, version) => {
    const newVersion = Object.assign({}, version);
    if (part === 'major') {
        newVersion.major = version.major + 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
    } else if (part === 'minor') {
        newVersion.minor = version.minor + 1;
        newVersion.patch = 0;
    } else {
        newVersion.patch = version.minor + 1;
    }

    return newVersion;
}

const versionObjectToString = (version) => `${version.major}.${version.minor}.${version.minor}`;

async function run() {
    if (github.context.eventName !== 'pull_request') {
        console.info('This action has not been prepared to use in other events than pulL_request');
        return;
    }

    console.log(github);
    if (!github.context.payload.pull_request.merged) {
        return;
    }

    const githubToken = core.getInput('githubToken');
    const octokit = github.getOctokit(githubToken)

    const { data: tags } = await octokit.repos.listTags({
        ...github.context.repo
    });

    console.log(github.context.payload.pull_request.head.ref);
    console.log(github.context.payload.pull_request.base.ref);

    const newVersion = incrementPart(
        specifyPart(github.context.payload.pull_request.head.ref, github.context.payload.pull_request.base.ref),
        decomposeVersion(tags.map(cleanupVersion).sort().pop() || '0.0.0')
    );

    console.log(tags.map(cleanupVersion).sort().pop() || '0.0.0')
    console.log(newVersion);

    octokit.git.createTag({
        tag: versionObjectToString(newVersion),
        message: github.context.payload.comment,
        object: github.context.sha,
        type: 'commit'
    });
}

run();
