// Backbone constructs the element and calls initialize before native subclass
// constructors return. Bind application methods here, once, so callbacks used
// during initialization keep the same identity for their entire lifetime.
module.exports = function bindViewMethods(view) {
  for (let prototype = Object.getPrototypeOf(view);
    prototype && prototype !== Backbone.View.prototype;
    prototype = Object.getPrototypeOf(prototype)) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor' || Object.prototype.hasOwnProperty.call(view, name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (typeof descriptor.value === 'function') view[name] = descriptor.value.bind(view);
    }
  }
};
