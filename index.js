const core = require('@actions/core');
const github = require('@actions/github');

const cleanupVersion = version => version.name.replace(/[_\-\/]/g, '.')

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
    console.log(part);
    console.log(version);

    const newVersion = Object.assign({}, version);
    if (part === 'major') {
        console.log('major increment');
        newVersion.major = version.major + 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
    } else if (part === 'minor') {
        console.log('minor increment');
        newVersion.minor = version.minor + 1;
        newVersion.patch = 0;
    } else {
        console.log('patch increment');
        newVersion.patch = version.patch + 1;
    }

    return newVersion;
}

const versionObjectToString = (version) => `${version.major}.${version.minor}.${version.patch}`;

const run = async () => {
    if (github.context.eventName !== 'pull_request') {
        console.info('This action has not been prepared to use in other events than pulL_request');
        return;
    }

    if (!github.context.payload.pull_request.merged) {
        return;
    }

    const githubToken = core.getInput('githubToken');
    const octokit = github.getOctokit(githubToken)

    console.info('Getting list of all tags.');
    const { data: tags } = await octokit.repos.listTags({
        ...github.context.repo
    });

    let currentVersion = tags.map(cleanupVersion).sort().pop();
    if (typeof currentVersion === 'undefined') {
        currentVersion = '0.0.0';
    }

    console.info(`Current tag: ${currentVersion}`);
    const newVersion = incrementPart(
        specifyPart(github.context.payload.pull_request.head.ref, github.context.payload.pull_request.base.ref),
        decomposeVersion(currentVersion)
    );

    console.info(`New tag: ${versionObjectToString(newVersion)}`);
    const { data: createdTag } = await octokit.git.createTag({
        tag: versionObjectToString(newVersion),
        message: 'auto tag created',
        object: github.context.sha,
        type: 'commit',
        ...github.context.repo
    });

    if (typeof createdTag === 'undefined') {
        console.error('tagging has not been finished successfully');
        return 1;
    }

    console.info('Creating reference.');
    await octokit.git.createRef({
        sha: createdTag.sha,
        ref: 'refs/tags/' + versionObjectToString(newVersion),
        ...github.context.repo
    });

    console.info('Tagged successfully.');

    return 0;
}

run();
