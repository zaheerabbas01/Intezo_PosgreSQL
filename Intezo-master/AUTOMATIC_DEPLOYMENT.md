# Automatic AWS deployment

Intezo uses GitHub Actions for production deployment. A push to `main` deploys only the application that changed:

- `frontend-intezo` builds with Node 22, uploads to the private frontend S3 bucket, and invalidates CloudFront.
- `backend-intezo`, `Caddyfile`, or `docker-compose.production.yml` changes are packaged without secrets, uploaded to the private deployment bucket, and deployed to EC2 through Systems Manager.
- The backend deployment waits for `https://api.intezo.online/healthz`. If startup or the health check fails, it attempts to restart the previous release and marks the GitHub job as failed.

GitHub authenticates using short-lived AWS OIDC credentials. Do not add AWS access keys to GitHub.

## One-time AWS setup

1. Open **AWS Console → CloudFormation** in **Asia Pacific (Mumbai), `ap-south-1`**.
2. Choose **Create stack → With new resources → Upload a template file**.
3. Upload `Intezo-master/infra/github-actions-oidc-role.yml` from the repository.
4. Use stack name `intezo-github-deployment`.
5. Keep the supplied defaults and continue.
6. On the final page, acknowledge that the stack creates a named IAM role, then create the stack.
7. Wait for `CREATE_COMPLETE`.
8. Open the stack's **Outputs** tab and copy `GitHubActionsRoleArn`.

If AWS reports that `token.actions.githubusercontent.com` already exists, do not create a second provider. Update the template to reference the existing provider ARN, or remove the existing unused provider before retrying.

## One-time GitHub setup

1. Open the `zaheerabbas01/Intezo_PosgreSQL` repository.
2. Open **Settings → Secrets and variables → Actions → Variables**.
3. Create a repository variable named `AWS_ROLE_ARN`.
4. Paste the `GitHubActionsRoleArn` CloudFormation output as its value.
5. Confirm that `.github/workflows/deploy-production.yml` is at the repository root. It must not be inside `Intezo-master/.github`.

## First deployment

The local Git root is `C:\Projects\intezo-postgreSQL`, one level above the application folder. Review changes from that directory before committing:

```powershell
cd C:\Projects\intezo-postgreSQL
git status
```

Do not commit `.env` files, database passwords, AWS keys, patient uploads, or generated build folders. After committing and pushing the intended project changes to `main`, open **GitHub → Actions → Deploy production** to watch the deployment.

The workflow can also be run manually using **Run workflow**. A manual run deploys both frontend and backend.

## Normal daily workflow

```powershell
cd C:\Projects\intezo-postgreSQL
git add <only-the-files-you-reviewed>
git commit -m "Describe the change"
git push origin main
```

The push starts deployment automatically. Check the GitHub Actions run and wait for both jobs to turn green before testing production.

## Important operational notes

- Production secrets stay in `/opt/intezo/shared/backend.env` on EC2. The workflow never packages that file.
- Each backend release is stored under `/opt/intezo/releases/<git-commit>` for traceability and rollback.
- Database migrations run before the API starts. Make migrations backward-compatible because a database migration is not automatically reversed during application rollback.
- GitHub Actions usage is subject to the allowance of the repository's GitHub plan. AWS CodePipeline is not required.
