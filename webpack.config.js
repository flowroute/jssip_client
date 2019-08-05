const path = require('path');

module.exports = {
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
