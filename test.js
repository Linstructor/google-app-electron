const lol = require('./index')({debug: true});
lol.on(lol.events.READY, () => console.log('ready'));
setTimeout(() => console.log('timeout'), 10000);
