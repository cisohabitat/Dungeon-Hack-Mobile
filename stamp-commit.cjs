'use strict';
// Deployment identity is stamped after checkout, so it names this commit,
// rather than the parent of a commit containing its own metadata.
const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync}=require('node:fs');
const path=require('node:path');
function commitSha() {
  const sha=process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git',['rev-parse','HEAD'],{cwd:__dirname,encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('A full Git commit SHA is required.');
  return sha;
}
function stampHTML(html,sha) {
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Invalid commit SHA.');
  if(!/<meta name="commit" content="(?:__COMMIT_SHA__|[a-f0-9]{40})">/.test(html))throw new Error('Missing commit meta tag.');
  return html.replace(/(<meta name="commit" content=")[^"]+(">)/,(_match,open,close)=>open+sha+close);
}
if(require.main===module){
  const file=path.join(__dirname,'index.html');
  writeFileSync(file,stampHTML(readFileSync(file,'utf8'),commitSha()));
}
module.exports={commitSha,stampHTML};
