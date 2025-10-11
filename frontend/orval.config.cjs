module.exports = {
    "oil-openapi-file": {
      input: "../docs/openapi.yaml",
      output: {
        mode: "tags-split",
        target: "app/lib/api/client.ts",
        schemas: "app/lib/api/models",
        client: "fetch",
        override: {
          mutator: {
            path: "app/lib/api/custom-fetch.ts",
            name: "customFetch",
          },
        },
      },
    },
  };
  