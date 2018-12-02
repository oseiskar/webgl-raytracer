const dat = require('dat.gui');

// pimped API for dat.GUI
function GUI() {
  const options = {};
  let anyChangeCallback;

  this.dat = new dat.GUI();

  const anyChange = () => {
    if (anyChangeCallback) anyChangeCallback(options);
  };

  this.add = (name, defaultValue, ...args) => {
    if (args && args[0] && !Array.isArray(args[0]) && args[0].hasOwnProperty(defaultValue)) {
      options[name] = args[0][defaultValue];
    } else {
      options[name] = defaultValue;
    }
    const ctrl = this.dat.add(options, name, ...args);
    ctrl.onFinishChange(() => anyChange());
    ctrl.listen();
    return ctrl;
  }

  this.addButton = (name, action) => {
    options[name] = action;
    this.dat.add(options, name);
  };

  this.onChange = (func) => {
    const prev = anyChangeCallback;
    anyChangeCallback = func;
    if (!prev) anyChange();
  };
}

module.exports = GUI;
