# GitHub Package Registry Publishing Guide

## Setup Requirements

### 1. GitHub Personal Access Token (PAT)

Create a Personal Access Token with the following permissions:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `write:packages` (to publish packages)
   - `read:packages` (to install packages)
   - `delete:packages` (optional, to delete package versions)
   - `repo` (if your repository is private)
4. Copy the generated token

### 2. Configure Authentication

#### For Local Development

Set up your environment:

```bash
# Option 1: Export as environment variable
export GITHUB_TOKEN=your_personal_access_token_here

# Option 2: Add to ~/.bashrc or ~/.zshrc
echo "export GITHUB_TOKEN=your_personal_access_token_here" >> ~/.zshrc
source ~/.zshrc

# Option 3: Create a .env file (don't commit this!)
echo "GITHUB_TOKEN=your_personal_access_token_here" > .env
```

#### Authenticate with npm

```bash
# Login to GitHub Package Registry
npm login --scope=@anssip --registry=https://npm.pkg.github.com
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN (not your GitHub password!)
# Email: YOUR_EMAIL
```

## Publishing the Package

### Manual Publishing

1. **Ensure you're in the project directory:**
   ```bash
   cd /Users/anssi/projects/spotcanvas/rs-charts
   ```

2. **Build the package:**
   ```bash
   bun run build
   ```

3. **Test the package (optional but recommended):**
   ```bash
   bun test
   ```

4. **Update version (if needed):**
   ```bash
   # Patch version (1.2.3 → 1.2.4)
   npm version patch
   
   # Minor version (1.2.3 → 1.3.0)
   npm version minor
   
   # Major version (1.2.3 → 2.0.0)
   npm version major
   
   # Specific version
   npm version 1.2.5
   ```

5. **Publish to GitHub Package Registry:**
   ```bash
   npm publish
   ```

### Automated Publishing with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/publish-package.yml`) that automatically publishes the package.

#### Trigger Methods:

1. **On Release:**
   - Create a new release on GitHub
   - The package will automatically be published with the release tag version

2. **Manual Trigger:**
   - Go to Actions tab in your GitHub repository
   - Select "Publish Package to GitHub Packages"
   - Click "Run workflow"
   - Optionally specify a version number

## Installing the Package

### For Private Repository Access

Users need to authenticate first:

1. **Create `.npmrc` in the project that will use the package:**
   ```bash
   echo "@anssip:registry=https://npm.pkg.github.com" >> .npmrc
   echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc
   ```

2. **Set up GitHub token:**
   ```bash
   export GITHUB_TOKEN=your_personal_access_token
   ```

3. **Install the package:**
   ```bash
   npm install @anssip/rs-charts
   # or
   bun add @anssip/rs-charts
   ```

### For Public Repository (if you make it public later)

If the repository is public, users can install without authentication:

```bash
# First, configure npm to use GitHub Packages for your scope
npm config set @anssip:registry https://npm.pkg.github.com

# Then install
npm install @anssip/rs-charts
```

## Using the Package in Your Project

```javascript
// ES Module import
import { ChartComponent } from '@anssip/rs-charts';

// Or import specific components
import '@anssip/rs-charts';
```

```html
<!-- In HTML -->
<script type="module">
  import '@anssip/rs-charts';
</script>

<!-- Use the web components -->
<chart-component></chart-component>
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized Error:**
   - Ensure your GitHub token has the correct permissions
   - Check that you're logged in: `npm whoami --registry=https://npm.pkg.github.com`
   - Re-authenticate: `npm login --scope=@anssip --registry=https://npm.pkg.github.com`

2. **404 Not Found Error:**
   - Verify the package name matches your GitHub username
   - Ensure the repository exists and you have access
   - Check that the package has been published

3. **E403 Forbidden:**
   - The package name must match your GitHub username or organization
   - For `@anssip/rs-charts`, you must be publishing from the `anssip` GitHub account

4. **Package Not Installing:**
   - Clear npm cache: `npm cache clean --force`
   - Delete `node_modules` and `package-lock.json`, then reinstall
   - Verify `.npmrc` configuration is correct

### Viewing Published Packages

Your published packages will appear at:
- Repository: `https://github.com/anssip/rs-charts/packages`
- Direct link: `https://github.com/users/anssip/packages/npm/package/rs-charts`

## Version Management

### Semantic Versioning

Follow semantic versioning (semver):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes (backward compatible)

### Pre-release Versions

```bash
# Beta version
npm version prerelease --preid=beta
# Result: 1.2.3 → 1.2.4-beta.0

# Alpha version
npm version prerelease --preid=alpha
# Result: 1.2.3 → 1.2.4-alpha.0
```

### Tagging Releases

```bash
# Publish with a tag
npm publish --tag beta

# Install specific tag
npm install @anssip/rs-charts@beta
```

## Security Best Practices

1. **Never commit tokens:** Add `.env` to `.gitignore`
2. **Use GitHub Secrets:** For CI/CD, use GitHub repository secrets
3. **Rotate tokens regularly:** Regenerate PATs periodically
4. **Minimal permissions:** Only grant necessary scopes to tokens
5. **Review access:** Regularly audit who has access to your packages

## Additional Resources

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [npm and GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Creating Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)