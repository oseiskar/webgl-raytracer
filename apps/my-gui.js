// dat.gui-like GUI
function GUI(el) {
  const options = {};
  let anyChangeCallback;

  const anyChange = () => {
    if (anyChangeCallback) anyChangeCallback(options);
  };

  function addRow() {
    const row = document.createElement('div');
    row.classList.add('row');
    row.classList.add('gui');
    el.appendChild(row);
    return row;
  }

  function createCol(content = '') {
    const col = document.createElement('div');
    col.classList.add('col');
    col.classList.add('gui');
    col.innerText = content;
    return col;
  }

  function addInput(name, defaultValue, opts, onChange) {
    if (opts && !Array.isArray(opts) && opts.hasOwnProperty(defaultValue)) {
      options[name] = opts[defaultValue];
    } else {
      options[name] = defaultValue;
    }

    const row = addRow();
    row.appendChild(createCol(name)); // label
    const inputCol = createCol();
    row.appendChild(inputCol);

    let input;
    if (opts === undefined) { // checkbox
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = defaultValue;
      input.onchange = () => {
        options[name] = input.checked;
        if (onChange) onChange(options);
      };
    } else {
      let obj;
      if (Array.isArray(opts)) {
        obj = {};
        opts.forEach((e) => {
          obj[e] = e;
        });
      } else {
        obj = { ...opts };
      }
      input = document.createElement('select');
      Object.keys(obj).forEach((key) => {
        const option = document.createElement('option');
        option.value = obj[key];
        option.innerText = key;
        input.appendChild(option);
      });
      input.value = obj[defaultValue];
      input.onchange = () => {
        options[name] = input.value;
        if (onChange) onChange(options);
      };
      // Bootstrap styles
      input.classList.add('form-control', 'form-control-sm');
    }
    input.classList.add('gui');
    inputCol.appendChild(input);
    return input;
  }

  this.add = (name, defaultValue, opts) => addInput(name, defaultValue, opts, anyChange);

  this.addIsolated = (name, defaultValue, opts, onChange) => addInput(name, defaultValue, opts, onChange);

  this.addButton = (name, action) => {
    options[name] = action;
    // this.dat.add(options, name);
    const col = createCol();
    btn = document.createElement('button');
    col.appendChild(btn);
    btn.innerText = name;
    // Bootstrap styles
    btn.classList.add('gui', 'btn', 'btn-sm');
    btn.onclick = action;

    const row = addRow();
    row.appendChild(createCol());
    row.appendChild(col);
    return btn;
  };

  this.onChange = (func) => {
    const prev = anyChangeCallback;
    anyChangeCallback = func;
    if (!prev) anyChange();
  };
}

module.exports = GUI;
