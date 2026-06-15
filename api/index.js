const serverless = require('serverless-http');
const { getApp } = require('../server/src/app');

let handler;

module.exports = async (req, res) => {
  if (!handler) {
    const app = await getApp();
    handler = serverless(app, { binary: ['image/*', 'multipart/form-data'] });
  }
  return handler(req, res);
};
