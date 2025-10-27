module.exports = {
  apps: [
    {
      name: "peak-sight",
      script:
        "export `cat .env` && PORT=3400 ~/.volta/bin/node standalone/server.js",
    },
  ],
};
