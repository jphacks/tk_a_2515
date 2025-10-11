module.exports = {
  "oil-openapi-file": {
    input: "../docs/openapi.yaml",
    output: {
      mode: "tags-split",
      target: "src/app/api/lib/client.ts",
      schemas: "src/app/api/lib/models",
      client: "fetch",
      override: {
        mutator: {
          path: "src/app/api/lib/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
};
