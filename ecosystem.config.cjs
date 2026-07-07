module.exports = {
  apps: [
    {
      name: "la-quincailler-backend",
      cwd: "./backend",
      script: "cmd.exe",
      args: "/c npm run dev",
    },
    {
      name: "la-quincailler-sync-worker",
      cwd: "./backend",
      script: "src/workers/syncWorker.js",
    },
    {
      name: "la-quincailler-frontend",
      cwd: "./frontend",
      script: "cmd.exe",
      args: "/c npm run dev",
    }
  ]
};
