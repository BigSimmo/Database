const major = Number(process.versions.node.split(".")[0]);
const npmUserAgent = process.env.npm_config_user_agent ?? "";
const npmVersion = npmUserAgent.match(/\bnpm\/(\d+\.\d+\.\d+)/)?.[1] ?? "";
const npmMajor = Number(npmVersion.split(".")[0]);

if (major !== 24) {
  console.error(`This project must be installed with Node 24.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

if (npmVersion && npmMajor !== 11) {
  console.error(`This project must be installed with npm 11.x. Current npm runtime: ${npmVersion}.`);
  process.exit(1);
}
