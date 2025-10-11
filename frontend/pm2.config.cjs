module.exports = {
  apps: [
    {
      name: "terview",
      script: "export `cat .env` && PORT=3400 ~/.volta/bin/pnpm start",
    },
  ],
};
