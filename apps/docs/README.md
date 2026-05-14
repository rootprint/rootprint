# Logwiz docs site

This directory contains the Mintlify documentation site for Logwiz.

## Local development

Install the Mintlify CLI:

```bash
npm i -g mint
```

Run the docs site from this directory:

```bash
mint dev
```

Preview the site at `http://localhost:3000`.

## Writing guidelines

- Use active voice and address the reader as "you"
- Lead with the task or outcome, then explain context
- Keep setup steps concrete and copy-pasteable
- Update screenshots, examples, and navigation when behavior changes

## Before opening a pull request

- Run `mint dev` and check the changed pages locally
- Verify links and navigation for the edited section
- Keep docs changes aligned with the website and root README positioning

## Resources

- Product docs config: `docs-site/docs.json`
- Main contribution guide: `../CONTRIBUTING.md`
- Mintlify docs: https://mintlify.com/docs
