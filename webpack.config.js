const path = require('path');
const merge = require('webpack-merge');

const demoConfig = {
  mode: 'development',
  entry: './src/FlowrouteClient.js',
  output: {
    path: path.resolve(__dirname, 'demo'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
};

const releaseConfig = merge(demoConfig, {
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'releases'),
    filename: `jssip-client-${process.env.VERSION}.js`,
  },
});

module.exports = [
  demoConfig,
  releaseConfig,
];
