module.exports = {
  apps: [
    {
      name: 'kaizen-crm-api',
      script: './server.js',
      cwd: __dirname,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
