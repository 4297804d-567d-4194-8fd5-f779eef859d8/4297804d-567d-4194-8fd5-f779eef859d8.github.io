var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var ZapThreads = function() {
  var _map, _a, _triggers, _b;
  "use strict";
  const equalFn = (a, b) => a === b;
  const $PROXY = Symbol("solid-proxy");
  const $TRACK = Symbol("solid-track");
  const signalOptions = {
    equals: equalFn
  };
  let runEffects = runQueue;
  const STALE = 1;
  const PENDING = 2;
  const UNOWNED = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null
  };
  const NO_INIT = {};
  var Owner = null;
  let Transition = null;
  let ExternalSourceConfig = null;
  let Listener = null;
  let Updates = null;
  let Effects = null;
  let ExecCount = 0;
  function createRoot(fn, detachedOwner) {
    const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root = unowned ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: current ? current.context : null,
      owner: current
    }, updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
    Owner = root;
    Listener = null;
    try {
      return runUpdates(updateFn, true);
    } finally {
      Listener = listener;
      Owner = owner;
    }
  }
  function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
      value,
      observers: null,
      observerSlots: null,
      comparator: options.equals || void 0
    };
    const setter = (value2) => {
      if (typeof value2 === "function") {
        value2 = value2(s.value);
      }
      return writeSignal(s, value2);
    };
    return [readSignal.bind(s), setter];
  }
  function createComputed(fn, value, options) {
    const c = createComputation(fn, value, true, STALE);
    updateComputation(c);
  }
  function createRenderEffect(fn, value, options) {
    const c = createComputation(fn, value, false, STALE);
    updateComputation(c);
  }
  function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false, STALE), s = SuspenseContext && useContext(SuspenseContext);
    if (s)
      c.suspense = s;
    if (!options || !options.render)
      c.user = true;
    Effects ? Effects.push(c) : updateComputation(c);
  }
  function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true, 0);
    c.observers = null;
    c.observerSlots = null;
    c.comparator = options.equals || void 0;
    updateComputation(c);
    return readSignal.bind(c);
  }
  function isPromise(v) {
    return v && typeof v === "object" && "then" in v;
  }
  function createResource(pSource, pFetcher, pOptions) {
    let source;
    let fetcher;
    let options;
    if (arguments.length === 2 && typeof pFetcher === "object" || arguments.length === 1) {
      source = true;
      fetcher = pSource;
      options = pFetcher || {};
    } else {
      source = pSource;
      fetcher = pFetcher;
      options = pOptions || {};
    }
    let pr = null, initP = NO_INIT, scheduled = false, resolved = "initialValue" in options, dynamic = typeof source === "function" && createMemo(source);
    const contexts = /* @__PURE__ */ new Set(), [value, setValue] = (options.storage || createSignal)(options.initialValue), [error, setError] = createSignal(void 0), [track, trigger] = createSignal(void 0, {
      equals: false
    }), [state, setState] = createSignal(resolved ? "ready" : "unresolved");
    function loadEnd(p, v, error2, key) {
      if (pr === p) {
        pr = null;
        key !== void 0 && (resolved = true);
        if ((p === initP || v === initP) && options.onHydrated)
          queueMicrotask(
            () => options.onHydrated(key, {
              value: v
            })
          );
        initP = NO_INIT;
        completeLoad(v, error2);
      }
      return v;
    }
    function completeLoad(v, err) {
      runUpdates(() => {
        if (err === void 0)
          setValue(() => v);
        setState(err !== void 0 ? "errored" : resolved ? "ready" : "unresolved");
        setError(err);
        for (const c of contexts.keys())
          c.decrement();
        contexts.clear();
      }, false);
    }
    function read() {
      const c = SuspenseContext, v = value(), err = error();
      if (err !== void 0 && !pr)
        throw err;
      if (Listener && !Listener.user && c) {
        createComputed(() => {
          track();
          if (pr) {
            if (c.resolved)
              ;
            else if (!contexts.has(c)) {
              c.increment();
              contexts.add(c);
            }
          }
        });
      }
      return v;
    }
    function load(refetching = true) {
      if (refetching !== false && scheduled)
        return;
      scheduled = false;
      const lookup = dynamic ? dynamic() : source;
      if (lookup == null || lookup === false) {
        loadEnd(pr, untrack(value));
        return;
      }
      const p = initP !== NO_INIT ? initP : untrack(
        () => fetcher(lookup, {
          value: value(),
          refetching
        })
      );
      if (!isPromise(p)) {
        loadEnd(pr, p, void 0, lookup);
        return p;
      }
      pr = p;
      if ("value" in p) {
        if (p.status === "success")
          loadEnd(pr, p.value, void 0, lookup);
        else
          loadEnd(pr, void 0, void 0, lookup);
        return p;
      }
      scheduled = true;
      queueMicrotask(() => scheduled = false);
      runUpdates(() => {
        setState(resolved ? "refreshing" : "pending");
        trigger();
      }, false);
      return p.then(
        (v) => loadEnd(p, v, void 0, lookup),
        (e) => loadEnd(p, void 0, castError(e), lookup)
      );
    }
    Object.defineProperties(read, {
      state: {
        get: () => state()
      },
      error: {
        get: () => error()
      },
      loading: {
        get() {
          const s = state();
          return s === "pending" || s === "refreshing";
        }
      },
      latest: {
        get() {
          if (!resolved)
            return read();
          const err = error();
          if (err && !pr)
            throw err;
          return value();
        }
      }
    });
    if (dynamic)
      createComputed(() => load(false));
    else
      load(false);
    return [
      read,
      {
        refetch: load,
        mutate: setValue
      }
    ];
  }
  function batch(fn) {
    return runUpdates(fn, false);
  }
  function untrack(fn) {
    if (Listener === null)
      return fn();
    const listener = Listener;
    Listener = null;
    try {
      if (ExternalSourceConfig)
        ;
      return fn();
    } finally {
      Listener = listener;
    }
  }
  function on(deps, fn, options) {
    const isArray = Array.isArray(deps);
    let prevInput;
    let defer = options && options.defer;
    return (prevValue) => {
      let input;
      if (isArray) {
        input = Array(deps.length);
        for (let i2 = 0; i2 < deps.length; i2++)
          input[i2] = deps[i2]();
      } else
        input = deps();
      if (defer) {
        defer = false;
        return prevValue;
      }
      const result = untrack(() => fn(input, prevInput, prevValue));
      prevInput = input;
      return result;
    };
  }
  function onCleanup(fn) {
    if (Owner === null)
      ;
    else if (Owner.cleanups === null)
      Owner.cleanups = [fn];
    else
      Owner.cleanups.push(fn);
    return fn;
  }
  function getListener() {
    return Listener;
  }
  function useContext(context) {
    return Owner && Owner.context && Owner.context[context.id] !== void 0 ? Owner.context[context.id] : context.defaultValue;
  }
  let SuspenseContext;
  function readSignal() {
    if (this.sources && this.state) {
      if (this.state === STALE)
        updateComputation(this);
      else {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(this), false);
        Updates = updates;
      }
    }
    if (Listener) {
      const sSlot = this.observers ? this.observers.length : 0;
      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }
      if (!this.observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        this.observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
    }
    return this.value;
  }
  function writeSignal(node, value, isComp) {
    let current = node.value;
    if (!node.comparator || !node.comparator(current, value)) {
      node.value = value;
      if (node.observers && node.observers.length) {
        runUpdates(() => {
          for (let i2 = 0; i2 < node.observers.length; i2 += 1) {
            const o = node.observers[i2];
            const TransitionRunning = Transition && Transition.running;
            if (TransitionRunning && Transition.disposed.has(o))
              ;
            if (TransitionRunning ? !o.tState : !o.state) {
              if (o.pure)
                Updates.push(o);
              else
                Effects.push(o);
              if (o.observers)
                markDownstream(o);
            }
            if (!TransitionRunning)
              o.state = STALE;
          }
          if (Updates.length > 1e6) {
            Updates = [];
            if (false)
              ;
            throw new Error();
          }
        }, false);
      }
    }
    return value;
  }
  function updateComputation(node) {
    if (!node.fn)
      return;
    cleanNode(node);
    const time = ExecCount;
    runComputation(
      node,
      node.value,
      time
    );
  }
  function runComputation(node, value, time) {
    let nextValue;
    const owner = Owner, listener = Listener;
    Listener = Owner = node;
    try {
      nextValue = node.fn(value);
    } catch (err) {
      if (node.pure) {
        {
          node.state = STALE;
          node.owned && node.owned.forEach(cleanNode);
          node.owned = null;
        }
      }
      node.updatedAt = time + 1;
      return handleError(err);
    } finally {
      Listener = listener;
      Owner = owner;
    }
    if (!node.updatedAt || node.updatedAt <= time) {
      if (node.updatedAt != null && "observers" in node) {
        writeSignal(node, nextValue);
      } else
        node.value = nextValue;
      node.updatedAt = time;
    }
  }
  function createComputation(fn, init, pure, state = STALE, options) {
    const c = {
      fn,
      state,
      updatedAt: null,
      owned: null,
      sources: null,
      sourceSlots: null,
      cleanups: null,
      value: init,
      owner: Owner,
      context: Owner ? Owner.context : null,
      pure
    };
    if (Owner === null)
      ;
    else if (Owner !== UNOWNED) {
      {
        if (!Owner.owned)
          Owner.owned = [c];
        else
          Owner.owned.push(c);
      }
    }
    return c;
  }
  function runTop(node) {
    if (node.state === 0)
      return;
    if (node.state === PENDING)
      return lookUpstream(node);
    if (node.suspense && untrack(node.suspense.inFallback))
      return node.suspense.effects.push(node);
    const ancestors = [node];
    while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
      if (node.state)
        ancestors.push(node);
    }
    for (let i2 = ancestors.length - 1; i2 >= 0; i2--) {
      node = ancestors[i2];
      if (node.state === STALE) {
        updateComputation(node);
      } else if (node.state === PENDING) {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(node, ancestors[0]), false);
        Updates = updates;
      }
    }
  }
  function runUpdates(fn, init) {
    if (Updates)
      return fn();
    let wait = false;
    if (!init)
      Updates = [];
    if (Effects)
      wait = true;
    else
      Effects = [];
    ExecCount++;
    try {
      const res = fn();
      completeUpdates(wait);
      return res;
    } catch (err) {
      if (!wait)
        Effects = null;
      Updates = null;
      handleError(err);
    }
  }
  function completeUpdates(wait) {
    if (Updates) {
      runQueue(Updates);
      Updates = null;
    }
    if (wait)
      return;
    const e = Effects;
    Effects = null;
    if (e.length)
      runUpdates(() => runEffects(e), false);
  }
  function runQueue(queue) {
    for (let i2 = 0; i2 < queue.length; i2++)
      runTop(queue[i2]);
  }
  function runUserEffects(queue) {
    let i2, userLength = 0;
    for (i2 = 0; i2 < queue.length; i2++) {
      const e = queue[i2];
      if (!e.user)
        runTop(e);
      else
        queue[userLength++] = e;
    }
    for (i2 = 0; i2 < userLength; i2++)
      runTop(queue[i2]);
  }
  function lookUpstream(node, ignore) {
    node.state = 0;
    for (let i2 = 0; i2 < node.sources.length; i2 += 1) {
      const source = node.sources[i2];
      if (source.sources) {
        const state = source.state;
        if (state === STALE) {
          if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
            runTop(source);
        } else if (state === PENDING)
          lookUpstream(source, ignore);
      }
    }
  }
  function markDownstream(node) {
    for (let i2 = 0; i2 < node.observers.length; i2 += 1) {
      const o = node.observers[i2];
      if (!o.state) {
        o.state = PENDING;
        if (o.pure)
          Updates.push(o);
        else
          Effects.push(o);
        o.observers && markDownstream(o);
      }
    }
  }
  function cleanNode(node) {
    let i2;
    if (node.sources) {
      while (node.sources.length) {
        const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
        if (obs && obs.length) {
          const n = obs.pop(), s = source.observerSlots.pop();
          if (index < obs.length) {
            n.sourceSlots[s] = index;
            obs[index] = n;
            source.observerSlots[index] = s;
          }
        }
      }
    }
    if (node.owned) {
      for (i2 = node.owned.length - 1; i2 >= 0; i2--)
        cleanNode(node.owned[i2]);
      node.owned = null;
    }
    if (node.cleanups) {
      for (i2 = node.cleanups.length - 1; i2 >= 0; i2--)
        node.cleanups[i2]();
      node.cleanups = null;
    }
    node.state = 0;
  }
  function castError(err) {
    if (err instanceof Error)
      return err;
    return new Error(typeof err === "string" ? err : "Unknown error", {
      cause: err
    });
  }
  function handleError(err, owner = Owner) {
    const error = castError(err);
    throw error;
  }
  const FALLBACK = Symbol("fallback");
  function dispose(d) {
    for (let i2 = 0; i2 < d.length; i2++)
      d[i2]();
  }
  function indexArray(list, mapFn, options = {}) {
    let items = [], mapped = [], disposers = [], signals = [], len = 0, i2;
    onCleanup(() => dispose(disposers));
    return () => {
      const newItems = list() || [];
      newItems[$TRACK];
      return untrack(() => {
        if (newItems.length === 0) {
          if (len !== 0) {
            dispose(disposers);
            disposers = [];
            items = [];
            mapped = [];
            len = 0;
            signals = [];
          }
          if (options.fallback) {
            items = [FALLBACK];
            mapped[0] = createRoot((disposer) => {
              disposers[0] = disposer;
              return options.fallback();
            });
            len = 1;
          }
          return mapped;
        }
        if (items[0] === FALLBACK) {
          disposers[0]();
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
        }
        for (i2 = 0; i2 < newItems.length; i2++) {
          if (i2 < items.length && items[i2] !== newItems[i2]) {
            signals[i2](() => newItems[i2]);
          } else if (i2 >= items.length) {
            mapped[i2] = createRoot(mapper);
          }
        }
        for (; i2 < items.length; i2++) {
          disposers[i2]();
        }
        len = signals.length = disposers.length = newItems.length;
        items = newItems.slice(0);
        return mapped = mapped.slice(0, len);
      });
      function mapper(disposer) {
        disposers[i2] = disposer;
        const [s, set] = createSignal(newItems[i2]);
        signals[i2] = set;
        return mapFn(s, i2);
      }
    };
  }
  function createComponent(Comp, props) {
    return untrack(() => Comp(props || {}));
  }
  const narrowedError = (name) => `Stale read from <${name}>.`;
  function Index(props) {
    const fallback = "fallback" in props && {
      fallback: () => props.fallback
    };
    return createMemo(indexArray(() => props.each, props.children, fallback || void 0));
  }
  function Show(props) {
    const keyed = props.keyed;
    const condition = createMemo(() => props.when, void 0, {
      equals: (a, b) => keyed ? a === b : !a === !b
    });
    return createMemo(
      () => {
        const c = condition();
        if (c) {
          const child = props.children;
          const fn = typeof child === "function" && child.length > 0;
          return fn ? untrack(
            () => child(
              keyed ? c : () => {
                if (!untrack(condition))
                  throw narrowedError("Show");
                return props.when;
              }
            )
          ) : child;
        }
        return props.fallback;
      },
      void 0,
      void 0
    );
  }
  function reconcileArrays(parentNode, a, b) {
    let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
    while (aStart < aEnd || bStart < bEnd) {
      if (a[aStart] === b[bStart]) {
        aStart++;
        bStart++;
        continue;
      }
      while (a[aEnd - 1] === b[bEnd - 1]) {
        aEnd--;
        bEnd--;
      }
      if (aEnd === aStart) {
        const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
        while (bStart < bEnd)
          parentNode.insertBefore(b[bStart++], node);
      } else if (bEnd === bStart) {
        while (aStart < aEnd) {
          if (!map || !map.has(a[aStart]))
            a[aStart].remove();
          aStart++;
        }
      } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
        const node = a[--aEnd].nextSibling;
        parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
        parentNode.insertBefore(b[--bEnd], node);
        a[aEnd] = b[bEnd];
      } else {
        if (!map) {
          map = /* @__PURE__ */ new Map();
          let i2 = bStart;
          while (i2 < bEnd)
            map.set(b[i2], i2++);
        }
        const index = map.get(a[aStart]);
        if (index != null) {
          if (bStart < index && index < bEnd) {
            let i2 = aStart, sequence = 1, t;
            while (++i2 < aEnd && i2 < bEnd) {
              if ((t = map.get(a[i2])) == null || t !== index + sequence)
                break;
              sequence++;
            }
            if (sequence > index - bStart) {
              const node = a[aStart];
              while (bStart < index)
                parentNode.insertBefore(b[bStart++], node);
            } else
              parentNode.replaceChild(b[bStart++], a[aStart++]);
          } else
            aStart++;
        } else
          a[aStart++].remove();
      }
    }
  }
  const $$EVENTS = "_$DX_DELEGATE";
  function template(html, isCE, isSVG) {
    let node;
    const create = () => {
      const t = document.createElement("template");
      t.innerHTML = html;
      return isSVG ? t.content.firstChild.firstChild : t.content.firstChild;
    };
    const fn = isCE ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
    fn.cloneNode = fn;
    return fn;
  }
  function delegateEvents(eventNames, document2 = window.document) {
    const e = document2[$$EVENTS] || (document2[$$EVENTS] = /* @__PURE__ */ new Set());
    for (let i2 = 0, l = eventNames.length; i2 < l; i2++) {
      const name = eventNames[i2];
      if (!e.has(name)) {
        e.add(name);
        document2.addEventListener(name, eventHandler);
      }
    }
  }
  function setAttribute(node, name, value) {
    if (value == null)
      node.removeAttribute(name);
    else
      node.setAttribute(name, value);
  }
  function use(fn, element, arg) {
    return untrack(() => fn(element, arg));
  }
  function insert(parent, accessor, marker, initial) {
    if (marker !== void 0 && !initial)
      initial = [];
    if (typeof accessor !== "function")
      return insertExpression(parent, accessor, initial, marker);
    createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
  }
  function eventHandler(e) {
    const key = `$$${e.type}`;
    let node = e.composedPath && e.composedPath()[0] || e.target;
    if (e.target !== node) {
      Object.defineProperty(e, "target", {
        configurable: true,
        value: node
      });
    }
    Object.defineProperty(e, "currentTarget", {
      configurable: true,
      get() {
        return node || document;
      }
    });
    while (node) {
      const handler = node[key];
      if (handler && !node.disabled) {
        const data = node[`${key}Data`];
        data !== void 0 ? handler.call(node, data, e) : handler.call(node, e);
        if (e.cancelBubble)
          return;
      }
      node = node._$host || node.parentNode || node.host;
    }
  }
  function insertExpression(parent, value, current, marker, unwrapArray) {
    while (typeof current === "function")
      current = current();
    if (value === current)
      return current;
    const t = typeof value, multi = marker !== void 0;
    parent = multi && current[0] && current[0].parentNode || parent;
    if (t === "string" || t === "number") {
      if (t === "number")
        value = value.toString();
      if (multi) {
        let node = current[0];
        if (node && node.nodeType === 3) {
          node.data !== value && (node.data = value);
        } else
          node = document.createTextNode(value);
        current = cleanChildren(parent, current, marker, node);
      } else {
        if (current !== "" && typeof current === "string") {
          current = parent.firstChild.data = value;
        } else
          current = parent.textContent = value;
      }
    } else if (value == null || t === "boolean") {
      current = cleanChildren(parent, current, marker);
    } else if (t === "function") {
      createRenderEffect(() => {
        let v = value();
        while (typeof v === "function")
          v = v();
        current = insertExpression(parent, v, current, marker);
      });
      return () => current;
    } else if (Array.isArray(value)) {
      const array = [];
      const currentArray = current && Array.isArray(current);
      if (normalizeIncomingArray(array, value, current, unwrapArray)) {
        createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
        return () => current;
      }
      if (array.length === 0) {
        current = cleanChildren(parent, current, marker);
        if (multi)
          return current;
      } else if (currentArray) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else
          reconcileArrays(parent, current, array);
      } else {
        current && cleanChildren(parent);
        appendNodes(parent, array);
      }
      current = array;
    } else if (value.nodeType) {
      if (Array.isArray(current)) {
        if (multi)
          return current = cleanChildren(parent, current, marker, value);
        cleanChildren(parent, current, null, value);
      } else if (current == null || current === "" || !parent.firstChild) {
        parent.appendChild(value);
      } else
        parent.replaceChild(value, parent.firstChild);
      current = value;
    } else
      ;
    return current;
  }
  function normalizeIncomingArray(normalized, array, current, unwrap2) {
    let dynamic = false;
    for (let i2 = 0, len = array.length; i2 < len; i2++) {
      let item = array[i2], prev = current && current[normalized.length], t;
      if (item == null || item === true || item === false)
        ;
      else if ((t = typeof item) === "object" && item.nodeType) {
        normalized.push(item);
      } else if (Array.isArray(item)) {
        dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
      } else if (t === "function") {
        if (unwrap2) {
          while (typeof item === "function")
            item = item();
          dynamic = normalizeIncomingArray(
            normalized,
            Array.isArray(item) ? item : [item],
            Array.isArray(prev) ? prev : [prev]
          ) || dynamic;
        } else {
          normalized.push(item);
          dynamic = true;
        }
      } else {
        const value = String(item);
        if (prev && prev.nodeType === 3 && prev.data === value)
          normalized.push(prev);
        else
          normalized.push(document.createTextNode(value));
      }
    }
    return dynamic;
  }
  function appendNodes(parent, array, marker = null) {
    for (let i2 = 0, len = array.length; i2 < len; i2++)
      parent.insertBefore(array[i2], marker);
  }
  function cleanChildren(parent, current, marker, replacement) {
    if (marker === void 0)
      return parent.textContent = "";
    const node = replacement || document.createTextNode("");
    if (current.length) {
      let inserted = false;
      for (let i2 = current.length - 1; i2 >= 0; i2--) {
        const el = current[i2];
        if (node !== el) {
          const isParent = el.parentNode === parent;
          if (!inserted && !i2)
            isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
          else
            isParent && el.remove();
        } else
          inserted = true;
      }
    } else
      parent.insertBefore(node, marker);
    return [node];
  }
  function cloneProps(props) {
    const propKeys = Object.keys(props);
    return propKeys.reduce((memo, k) => {
      const prop = props[k];
      memo[k] = Object.assign({}, prop);
      if (isObject(prop.value) && !isFunction(prop.value) && !Array.isArray(prop.value))
        memo[k].value = Object.assign({}, prop.value);
      if (Array.isArray(prop.value))
        memo[k].value = prop.value.slice(0);
      return memo;
    }, {});
  }
  function normalizePropDefs(props) {
    if (!props)
      return {};
    const propKeys = Object.keys(props);
    return propKeys.reduce((memo, k) => {
      const v = props[k];
      memo[k] = !(isObject(v) && "value" in v) ? {
        value: v
      } : v;
      memo[k].attribute || (memo[k].attribute = toAttribute(k));
      memo[k].parse = "parse" in memo[k] ? memo[k].parse : typeof memo[k].value !== "string";
      return memo;
    }, {});
  }
  function propValues(props) {
    const propKeys = Object.keys(props);
    return propKeys.reduce((memo, k) => {
      memo[k] = props[k].value;
      return memo;
    }, {});
  }
  function initializeProps(element, propDefinition) {
    const props = cloneProps(propDefinition), propKeys = Object.keys(propDefinition);
    propKeys.forEach((key) => {
      const prop = props[key], attr = element.getAttribute(prop.attribute), value = element[key];
      if (attr)
        prop.value = prop.parse ? parseAttributeValue(attr) : attr;
      if (value != null)
        prop.value = Array.isArray(value) ? value.slice(0) : value;
      prop.reflect && reflect(element, prop.attribute, prop.value);
      Object.defineProperty(element, key, {
        get() {
          return prop.value;
        },
        set(val) {
          const oldValue = prop.value;
          prop.value = val;
          prop.reflect && reflect(this, prop.attribute, prop.value);
          for (let i2 = 0, l = this.__propertyChangedCallbacks.length; i2 < l; i2++) {
            this.__propertyChangedCallbacks[i2](key, val, oldValue);
          }
        },
        enumerable: true,
        configurable: true
      });
    });
    return props;
  }
  function parseAttributeValue(value) {
    if (!value)
      return;
    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  }
  function reflect(node, attribute, value) {
    if (value == null || value === false)
      return node.removeAttribute(attribute);
    let reflect2 = JSON.stringify(value);
    node.__updating[attribute] = true;
    if (reflect2 === "true")
      reflect2 = "";
    node.setAttribute(attribute, reflect2);
    Promise.resolve().then(() => delete node.__updating[attribute]);
  }
  function toAttribute(propName) {
    return propName.replace(/\.?([A-Z]+)/g, (x, y) => "-" + y.toLowerCase()).replace("_", "-").replace(/^-/, "");
  }
  function isObject(obj) {
    return obj != null && (typeof obj === "object" || typeof obj === "function");
  }
  function isFunction(val) {
    return Object.prototype.toString.call(val) === "[object Function]";
  }
  function isConstructor(f) {
    return typeof f === "function" && f.toString().indexOf("class") === 0;
  }
  let currentElement;
  function createElementType(BaseElement, propDefinition) {
    const propKeys = Object.keys(propDefinition);
    return class CustomElement extends BaseElement {
      static get observedAttributes() {
        return propKeys.map((k) => propDefinition[k].attribute);
      }
      constructor() {
        super();
        this.__initialized = false;
        this.__released = false;
        this.__releaseCallbacks = [];
        this.__propertyChangedCallbacks = [];
        this.__updating = {};
        this.props = {};
      }
      connectedCallback() {
        if (this.__initialized)
          return;
        this.__releaseCallbacks = [];
        this.__propertyChangedCallbacks = [];
        this.__updating = {};
        this.props = initializeProps(this, propDefinition);
        const props = propValues(this.props), ComponentType = this.Component, outerElement = currentElement;
        try {
          currentElement = this;
          this.__initialized = true;
          if (isConstructor(ComponentType))
            new ComponentType(props, {
              element: this
            });
          else
            ComponentType(props, {
              element: this
            });
        } finally {
          currentElement = outerElement;
        }
      }
      async disconnectedCallback() {
        await Promise.resolve();
        if (this.isConnected)
          return;
        this.__propertyChangedCallbacks.length = 0;
        let callback = null;
        while (callback = this.__releaseCallbacks.pop())
          callback(this);
        delete this.__initialized;
        this.__released = true;
      }
      attributeChangedCallback(name, oldVal, newVal) {
        if (!this.__initialized)
          return;
        if (this.__updating[name])
          return;
        name = this.lookupProp(name);
        if (name in propDefinition) {
          if (newVal == null && !this[name])
            return;
          this[name] = propDefinition[name].parse ? parseAttributeValue(newVal) : newVal;
        }
      }
      lookupProp(attrName) {
        if (!propDefinition)
          return;
        return propKeys.find((k) => attrName === k || attrName === propDefinition[k].attribute);
      }
      get renderRoot() {
        return this.shadowRoot || this.attachShadow({
          mode: "open"
        });
      }
      addReleaseCallback(fn) {
        this.__releaseCallbacks.push(fn);
      }
      addPropertyChangedCallback(fn) {
        this.__propertyChangedCallbacks.push(fn);
      }
    };
  }
  function register(tag, props = {}, options = {}) {
    const {
      BaseElement = HTMLElement,
      extension
    } = options;
    return (ComponentType) => {
      if (!tag)
        throw new Error("tag is required to register a Component");
      let ElementType = customElements.get(tag);
      if (ElementType) {
        ElementType.prototype.Component = ComponentType;
        return ElementType;
      }
      ElementType = createElementType(BaseElement, normalizePropDefs(props));
      ElementType.prototype.Component = ComponentType;
      ElementType.prototype.registeredTag = tag;
      customElements.define(tag, ElementType, extension);
      return ElementType;
    };
  }
  function createProps(raw) {
    const keys = Object.keys(raw);
    const props = {};
    for (let i2 = 0; i2 < keys.length; i2++) {
      const [get, set] = createSignal(raw[keys[i2]]);
      Object.defineProperty(props, keys[i2], {
        get,
        set(v) {
          set(() => v);
        }
      });
    }
    return props;
  }
  function lookupContext(el) {
    if (el.assignedSlot && el.assignedSlot._$owner)
      return el.assignedSlot._$owner;
    let next = el.parentNode;
    while (next && !next._$owner && !(next.assignedSlot && next.assignedSlot._$owner))
      next = next.parentNode;
    return next && next.assignedSlot ? next.assignedSlot._$owner : el._$owner;
  }
  function withSolid(ComponentType) {
    return (rawProps, options) => {
      const { element } = options;
      return createRoot((dispose2) => {
        const props = createProps(rawProps);
        element.addPropertyChangedCallback((key, val) => props[key] = val);
        element.addReleaseCallback(() => {
          element.renderRoot.textContent = "";
          dispose2();
        });
        const comp = ComponentType(props, options);
        return insert(element.renderRoot, comp);
      }, lookupContext(element));
    };
  }
  function customElement(tag, props, ComponentType) {
    if (arguments.length === 2) {
      ComponentType = props;
      props = {};
    }
    return register(tag, props)(withSolid(ComponentType));
  }
  var access = (v) => typeof v === "function" && !v.length ? v() : v;
  function observe(el, instance) {
    instance.observe(el);
  }
  function createVisibilityObserver(options, setter) {
    const callbacks = /* @__PURE__ */ new WeakMap();
    const io = new IntersectionObserver((entries, instance) => {
      var _a2;
      for (const entry of entries)
        (_a2 = callbacks.get(entry.target)) == null ? void 0 : _a2(entry, instance);
    }, options);
    onCleanup(() => io.disconnect());
    function removeEntry(el) {
      io.unobserve(el);
      callbacks.delete(el);
    }
    function addEntry(el, callback) {
      observe(el, io);
      callbacks.set(el, callback);
    }
    const getCallback = setter ? (get, set) => {
      const setterRef = access(setter);
      return (entry) => set(setterRef(entry, { visible: untrack(get) }));
    } : (_, set) => (entry) => set(entry.isIntersecting);
    return (element) => {
      const [isVisible, setVisible] = createSignal((options == null ? void 0 : options.initialValue) ?? false);
      const callback = getCallback(isVisible, setVisible);
      let prevEl;
      if (!(element instanceof Element)) {
        createEffect(() => {
          const el = element();
          if (el === prevEl)
            return;
          if (prevEl)
            removeEntry(prevEl);
          if (el)
            addEntry(el, callback);
          prevEl = el;
        });
      } else
        addEntry(element, callback);
      onCleanup(() => prevEl && removeEntry(prevEl));
      return isVisible;
    };
  }
  var triggerOptions = { equals: false };
  var triggerCacheOptions = triggerOptions;
  function createTrigger() {
    return createSignal(void 0, triggerOptions);
  }
  var TriggerCache = (_a = class {
    constructor(mapConstructor = Map) {
      __privateAdd(this, _map, void 0);
      __privateSet(this, _map, new mapConstructor());
    }
    dirty(key) {
      var _a2;
      (_a2 = __privateGet(this, _map).get(key)) == null ? void 0 : _a2.$$();
    }
    track(key) {
      if (!getListener())
        return;
      let trigger = __privateGet(this, _map).get(key);
      if (!trigger) {
        const [$, $$] = createSignal(void 0, triggerCacheOptions);
        __privateGet(this, _map).set(key, trigger = { $, $$, n: 1 });
      } else
        trigger.n++;
      onCleanup(() => {
        if (trigger.n-- === 1)
          queueMicrotask(() => trigger.n === 0 && __privateGet(this, _map).delete(key));
      });
      trigger.$();
    }
  }, _map = new WeakMap(), _a);
  const style = '#ztr-content,\n#ztr-content img {\n  max-width: 100%;\n}\n\n#ztr-root {\n  display: flex;\n  flex-direction: column;\n  font-family: var(--ztr-font);\n  font-size: var(--ztr-font-size);\n  color: var(--ztr-text-color);\n  border: 1px solid transparent;\n  word-wrap: break-word;\n  /* removes margin collapse */\n  margin-top: 0;\n  line-height: 1.2em;\n}\n\n#ztr-subtitle {\n  font-size: 1.2em;\n  color: #666;\n}\n\na {\n  color: var(--ztr-link-color);\n  text-decoration: none;\n}\n\n/* Comment */\n\n.ztr-comment {\n  position: relative;\n  margin: 0;\n  padding: 0;\n}\n\n.ztr-comment,\n.ztr-reply-button {\n  background-color: var(--ztr-background-color, rgba(0, 0, 0, 0.03));\n}\n\n.ztr-comment-body {\n  padding: 1em;\n}\n\n.ztr-comment:first-child {\n  border-top-left-radius: 0.3em;\n  border-top-right-radius: 0.3em;\n}\n\n.ztr-comment:last-child {\n  border-bottom-left-radius: 0.3em;\n  border-bottom-right-radius: 0.3em;\n}\n\n.ztr-comment-info-wrapper {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.ztr-comment-info {\n  display: flex;\n  align-items: center;\n}\n\n.ztr-comment-info-picture {\n  width: 3.5em;\n}\n\nul.ztr-comment-info-items {\n  display: flex;\n  align-items: center;\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  font-size: 0.9em;\n}\n\nul.ztr-comment-info-items li {\n  display: inline-block;\n  cursor: default;\n  padding-right: 0.5em;\n}\n\nul.ztr-comment-info-items li a {\n  font-weight: 600;\n}\n\n.ztr-comment-info-author a {\n  font-size: 1.2em;\n  padding-right: 0.2em;\n}\n\n.ztr-comment-info-dots {\n  cursor: pointer;\n}\n\n.ztr-comment-info-separator {\n  width: 0.5em;\n}\n\n.ztr-comment-info-picture img {\n  width: 2em;\n  height: 2em;\n  border-radius: 50%;\n  padding: 0.5em;\n  position: relative;\n  display: block;\n  object-fit: cover;\n}\n\n.ztr-comment-text,\n#ztr-content {\n  margin-bottom: 0.75em;\n  padding: 0 0.8em 0 3.5em;\n  line-height: 1.5em;\n  line-break: loose;\n  word-break: break-word;\n  overflow: hidden;\n  max-width: 37em;\n}\n\n.ztr-comment-text-fade {\n  position: relative;\n  max-height: 6em;\n}\n.ztr-comment-text-fade::after {\n  content: "";\n  text-align: right;\n  position: absolute;\n  bottom: 0;\n  right: 0;\n  width: 50%;\n  height: 1.5em;\n  background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1) 90%);\n}\n\n.ztr-comment-text p {\n  margin: 0 0 0.1em 0;\n}\n\n.ztr-comment-text code {\n  font-size: 1.1em;\n  margin: 0 0.2em;\n}\n\n.ztr-comment-text pre,\n.ztr-info-pane pre {\n  white-space: pre-wrap;\n  white-space: -moz-pre-wrap;\n  word-wrap: break-word;\n}\n\n.ztr-comment-text a:hover {\n  text-decoration: underline;\n}\n\n.ztr-comment-text img {\n  max-width: 100%;\n}\n\n.ztr-comment-text .warning {\n  margin-top: 0em;\n  font-size: 0.8em;\n  display: flex;\n  align-items: center;\n}\n\n.ztr-comment-text .warning svg {\n  height: 1.2em;\n  fill: #e4984d;\n  padding-right: 0.7em;\n}\n\n.ztr-comment-replies {\n  margin-left: 3em;\n}\n\n.ztr-comment-replies-info-actions {\n}\n\n.ztr-comment-replies-info-items {\n  margin: -0.5em;\n  display: flex;\n  list-style: none;\n  font-size: 0.9em;\n  font-weight: 600;\n  color: #BBB;\n  cursor: pointer;\n  width: 10em;\n  li {\n    padding: 1em;\n    padding-left: 1.3em;\n    margin: -0.8em;\n  }\n}\n\n.ztr-comment-replies-info-items.selected {\n  margin-bottom: 1.1em;\n  color: #0288d1;\n  svg {\n    fill: #0288d1;\n  }\n}\n\n.ztr-comment-replies-info-items:hover svg {\n  fill: #0288d1;\n}\n\n.ztr-comment-replies-info-items:hover li {\n  color: #0288d1;\n}\n\n.highlight p {\n  background: #F6AD55;\n  color: #2B2B2B;\n  display: inline;\n  padding: 0.2em;\n}\n\n/* Styling the reply to comment form */\n\n.ztr-comment-expand {\n  display: flex;\n  position: relative;\n  /*z-index: 1;*/\n  max-width: fit-content;\n  padding-top: 0.8em;\n  padding-bottom: 0.5em;\n  padding-left: 1.1em;\n  padding-right: 1em;\n  margin-left: 2.4em;\n  margin-top: -1em;\n  margin-bottom: 0.5em;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.ztr-comment-expand:hover span {\n  color: #0288d1;\n}\n\nul.ztr-comment-actions {\n  display: flex;\n  align-items: center;\n  list-style: none;\n  margin: 0;\n  padding: 0 0 0 2.625em;\n  font-weight: 600;\n  user-select: none;\n}\n\nul.ztr-comment-actions {\n  margin-top: -1em;\n}\n\nul.ztr-comment-actions li {\n  display: inline-flex;\n  align-items: center;\n  text-align: center;\n  padding: 1em;\n  margin: -0.125em;\n  cursor: pointer;\n}\n\nul.ztr-comment-actions li span {\n  padding: 0.25em 0.25em 0 0.25em;\n  color: var(--ztr-icon-color, #3B3B3B);\n}\n\nsvg {\n  fill: var(--ztr-icon-color, #3B3B3B);\n  width: 1.1em;\n  height: 1.1em;\n}\n\nli.ztr-comment-action-upvote {\n  margin-left: 0.5em;\n  margin-right: 0.5em;\n}\n\nli.ztr-comment-action-downvote {\n  margin-left: 0.5em;\n  margin-right: 0.5em;\n}\n\nli.ztr-comment-action-reply {\n  margin-left: 0.7em;\n  margin-right: 0.7em;\n}\n\nli.ztr-comment-action-zap {\n  margin-left: 0.7em;\n  margin-right: 0.7em;\n}\n\nli.ztr-comment-action-like {\n  margin-left: 0.7em;\n  margin-right: 0.7em;\n}\n\n.ztr-comment-action-reply:hover svg {\n  fill: #0288d1;\n}\n\n.ztr-comment-action-reply:hover span {\n  color: #0288d1;\n}\n\n.ztr-comment-action-zap:hover svg {\n  fill: #e4984d;\n}\n\n.ztr-comment-action-zap:hover span {\n  color: #e4984d;\n}\n\n.ztr-comment-action-like:hover svg {\n  fill: #e35428;\n}\n\n.ztr-comment-action-like:hover span {\n  color: #e35428;\n}\n\n.ztr-comment-action-upvote:hover svg {\n  fill: #0288d1;\n}\n\n.ztr-comment-action-upvote:hover span {\n  color: #0288d1;\n}\n\n.ztr-comment-action-upvote.selected {\n  svg {\n    fill: #0288d1;\n  }\n}\n\n.ztr-comment-action-downvote:hover svg {\n  fill: #0288d1;\n}\n\n.ztr-comment-action-downvote:hover span {\n  color: #0288d1;\n}\n\n.ztr-comment-action-downvote.selected {\n  svg {\n    fill: #0288d1;\n  }\n}\n\nli.ztr-comment-action-votes {\n  justify-content: center;\n  span {\n    margin-left: -0.7em;\n    margin-right: -0.7em;\n    font-size: 0.85em;\n  }\n}\n\n.ztr-reply-form {\n  padding: 0 0.5em 0 3.5em;\n}\n\n.ztr-reply-form textarea {\n  font-family: var(--ztr-font);\n  font-size: 1.1em;\n  line-height: 1.4;\n  color: #2B2B2B;\n  background-color: #FDFDFD;\n  border: 1px solid #BBB;\n  outline: none;\n  width: calc(100% - 1.5em);\n  padding: 0.7em;\n  margin: 0.5em 0;\n  height: 4em;\n  border-radius: 0.2em;\n  min-height: 4em;\n  resize: vertical;\n}\n\n.ztr-reply-form textarea.too-long {\n  border: 2px solid rgb(202, 23, 23);\n}\n\n.ztr-reply-form:disabled {\n  opacity: 65%;\n  user-select: none;\n}\n\n.ztr-reply-controls {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n}\n\n.ztr-reply-controls span {\n  font-weight: bold;\n  font-size: 0.85em;\n  margin-right: 1em;\n  user-select: none;\n  cursor: default;\n}\n\n.ztr-reply-error {\n  color: rgb(202, 23, 23);\n}\n\n.ztr-reply-controls button {\n  font-family: var(--ztr-font);\n  appearance: none;\n  border: none;\n  padding: 0.5em 1em;\n  border-radius: 0.2em;\n  font-size: 0.85em;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.ztr-reply-login-button {\n  color: white;\n  background-color: var(--ztr-login-button-color, #2B2B2B);\n  margin-left: 1em;\n}\n\n.ztr-reply-button {\n  color: var(--ztr-text-color);\n  display: flex;\n  align-items: center;\n}\n\n.ztr-info-pane {\n  padding: 0 0.5em 1em 3.5em;\n}\n\n.ztr-info-pane pre {\n  font-size: 0.8em;\n}\n\n.ztr-spinner {\n  width: 1.2em;\n  height: 1.2em;\n  padding: 0.9em;\n  animation: rotate 4s linear infinite;\n}\n\n.ztr-reply-button:disabled {\n  opacity: 65%;\n  pointer-events: none;\n  cursor: pointer;\n  user-select: none;\n}\n\n.ztr-spinner .path {\n  stroke: var(--ztr-text-color, #2B2B2B);\n  stroke-linecap: round;\n  animation: dash 1.5s ease-in-out infinite;\n}\n\n@keyframes rotate {\n  100% {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes dash {\n  0% {\n    stroke-dasharray: 1, 150;\n    stroke-dashoffset: 0;\n  }\n\n  50% {\n    stroke-dasharray: 90, 150;\n    stroke-dashoffset: -35;\n  }\n\n  100% {\n    stroke-dasharray: 90, 150;\n    stroke-dashoffset: -124;\n  }\n}\n\n/* new */\n\n.ztr-comment-new .ztr-reply-form {\n  margin: 0.5em 0;\n  padding: 0;\n}\n\n.ztr-comment-new .ztr-comment-body {\n  padding: 0;\n}\n\n.ztr-comment-new .ztr-comment-actions {\n  font-size: 1.1em;\n  padding: 0;\n}\n\n/* Dark mode defaults */\n\n/* @media (prefers-color-scheme: dark) { */\n  .ztr-spinner .path {\n    stroke: var(--ztr-text-color, #DEDEDE);\n  }\n\n  .ztr-comment,\n  .ztr-reply-button {\n    background-color: var(--ztr-background-color, rgba(255, 255, 255, 0.06));\n  }\n\n  .ztr-reply-login-button {\n    color: #2B2B2B;\n    background-color: var(--ztr-login-button-color, #DEDEDE);\n  }\n\n  svg {\n    fill: var(--ztr-icon-color, #DEDEDE);\n  }\n\n  ul.ztr-comment-actions li span {\n    color: var(--ztr-icon-color);\n  }\n\n  .ztr-comment-action-reply:hover svg {\n    fill: #0288d1;\n  }\n\n  .ztr-comment-action-reply:hover span {\n    color: #0288d1;\n  }\n/* } */\n';
  var $KEYS = Symbol("track-keys");
  var ReactiveSet = (_b = class extends Set {
    constructor(values) {
      super();
      __privateAdd(this, _triggers, new TriggerCache());
      if (values)
        for (const v of values)
          super.add(v);
    }
    // reads
    get size() {
      __privateGet(this, _triggers).track($KEYS);
      return super.size;
    }
    has(v) {
      __privateGet(this, _triggers).track(v);
      return super.has(v);
    }
    *keys() {
      for (const key of super.keys()) {
        __privateGet(this, _triggers).track(key);
        yield key;
      }
      __privateGet(this, _triggers).track($KEYS);
    }
    values() {
      return this.keys();
    }
    *entries() {
      for (const key of super.keys()) {
        __privateGet(this, _triggers).track(key);
        yield [key, key];
      }
      __privateGet(this, _triggers).track($KEYS);
    }
    [Symbol.iterator]() {
      return this.values();
    }
    forEach(callbackfn) {
      __privateGet(this, _triggers).track($KEYS);
      super.forEach(callbackfn);
    }
    // writes
    add(v) {
      if (!super.has(v)) {
        super.add(v);
        batch(() => {
          __privateGet(this, _triggers).dirty(v);
          __privateGet(this, _triggers).dirty($KEYS);
        });
      }
      return this;
    }
    delete(v) {
      const r = super.delete(v);
      if (r) {
        batch(() => {
          __privateGet(this, _triggers).dirty(v);
          __privateGet(this, _triggers).dirty($KEYS);
        });
      }
      return r;
    }
    clear() {
      if (super.size) {
        batch(() => {
          for (const v of super.keys())
            __privateGet(this, _triggers).dirty(v);
          super.clear();
          __privateGet(this, _triggers).dirty($KEYS);
        });
      }
    }
  }, _triggers = new WeakMap(), _b);
  function number$1(n) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error(`Wrong positive integer: ${n}`);
  }
  function bytes$1(b, ...lengths) {
    if (!(b instanceof Uint8Array))
      throw new Error("Expected Uint8Array");
    if (lengths.length > 0 && !lengths.includes(b.length))
      throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
  }
  function hash$1(hash2) {
    if (typeof hash2 !== "function" || typeof hash2.create !== "function")
      throw new Error("Hash should be wrapped by utils.wrapConstructor");
    number$1(hash2.outputLen);
    number$1(hash2.blockLen);
  }
  function exists$1(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function output$1(out, instance) {
    bytes$1(out);
    const min = instance.outputLen;
    if (out.length < min) {
      throw new Error(`digestInto() expects output buffer of length at least ${min}`);
    }
  }
  const crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const u8a$2 = (a) => a instanceof Uint8Array;
  const createView$1 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  const rotr$1 = (word, shift) => word << 32 - shift | word >>> shift;
  const isLE$1 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
  if (!isLE$1)
    throw new Error("Non little-endian hardware is not supported");
  function utf8ToBytes$2(str) {
    if (typeof str !== "string")
      throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function toBytes$1(data) {
    if (typeof data === "string")
      data = utf8ToBytes$2(data);
    if (!u8a$2(data))
      throw new Error(`expected Uint8Array, got ${typeof data}`);
    return data;
  }
  function concatBytes$1(...arrays) {
    const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
    let pad = 0;
    arrays.forEach((a) => {
      if (!u8a$2(a))
        throw new Error("Uint8Array expected");
      r.set(a, pad);
      pad += a.length;
    });
    return r;
  }
  let Hash$1 = class Hash {
    // Safe version that clones internal state
    clone() {
      return this._cloneInto();
    }
  };
  function wrapConstructor$1(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes$1(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
  }
  function randomBytes(bytesLength = 32) {
    if (crypto && typeof crypto.getRandomValues === "function") {
      return crypto.getRandomValues(new Uint8Array(bytesLength));
    }
    throw new Error("crypto.getRandomValues must be defined");
  }
  function setBigUint64$1(view, byteOffset, value, isLE2) {
    if (typeof view.setBigUint64 === "function")
      return view.setBigUint64(byteOffset, value, isLE2);
    const _32n = BigInt(32);
    const _u32_max = BigInt(4294967295);
    const wh = Number(value >> _32n & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE2 ? 4 : 0;
    const l = isLE2 ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE2);
    view.setUint32(byteOffset + l, wl, isLE2);
  }
  let SHA2$1 = class SHA2 extends Hash$1 {
    constructor(blockLen, outputLen, padOffset, isLE2) {
      super();
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.finished = false;
      this.length = 0;
      this.pos = 0;
      this.destroyed = false;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView$1(this.buffer);
    }
    update(data) {
      exists$1(this);
      const { view, buffer, blockLen } = this;
      data = toBytes$1(data);
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView$1(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
        }
      }
      this.length += data.length;
      this.roundClean();
      return this;
    }
    digestInto(out) {
      exists$1(this);
      output$1(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      this.buffer.subarray(pos).fill(0);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        pos = 0;
      }
      for (let i2 = pos; i2 < blockLen; i2++)
        buffer[i2] = 0;
      setBigUint64$1(view, blockLen - 8, BigInt(this.length * 8), isLE2);
      this.process(view, 0);
      const oview = createView$1(out);
      const len = this.outputLen;
      if (len % 4)
        throw new Error("_sha2: outputLen should be aligned to 32bit");
      const outLen = len / 4;
      const state = this.get();
      if (outLen > state.length)
        throw new Error("_sha2: outputLen bigger than state");
      for (let i2 = 0; i2 < outLen; i2++)
        oview.setUint32(4 * i2, state[i2], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      to || (to = new this.constructor());
      to.set(...this.get());
      const { blockLen, buffer, length, finished, destroyed, pos } = this;
      to.length = length;
      to.pos = pos;
      to.finished = finished;
      to.destroyed = destroyed;
      if (length % blockLen)
        to.buffer.set(buffer);
      return to;
    }
  };
  const Chi$1 = (a, b, c) => a & b ^ ~a & c;
  const Maj$1 = (a, b, c) => a & b ^ a & c ^ b & c;
  const SHA256_K$1 = /* @__PURE__ */ new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  const IV$1 = /* @__PURE__ */ new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const SHA256_W$1 = /* @__PURE__ */ new Uint32Array(64);
  let SHA256$1 = class SHA256 extends SHA2$1 {
    constructor() {
      super(64, 32, 8, false);
      this.A = IV$1[0] | 0;
      this.B = IV$1[1] | 0;
      this.C = IV$1[2] | 0;
      this.D = IV$1[3] | 0;
      this.E = IV$1[4] | 0;
      this.F = IV$1[5] | 0;
      this.G = IV$1[6] | 0;
      this.H = IV$1[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    process(view, offset) {
      for (let i2 = 0; i2 < 16; i2++, offset += 4)
        SHA256_W$1[i2] = view.getUint32(offset, false);
      for (let i2 = 16; i2 < 64; i2++) {
        const W15 = SHA256_W$1[i2 - 15];
        const W2 = SHA256_W$1[i2 - 2];
        const s0 = rotr$1(W15, 7) ^ rotr$1(W15, 18) ^ W15 >>> 3;
        const s1 = rotr$1(W2, 17) ^ rotr$1(W2, 19) ^ W2 >>> 10;
        SHA256_W$1[i2] = s1 + SHA256_W$1[i2 - 7] + s0 + SHA256_W$1[i2 - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i2 = 0; i2 < 64; i2++) {
        const sigma1 = rotr$1(E, 6) ^ rotr$1(E, 11) ^ rotr$1(E, 25);
        const T1 = H + sigma1 + Chi$1(E, F, G) + SHA256_K$1[i2] + SHA256_W$1[i2] | 0;
        const sigma0 = rotr$1(A, 2) ^ rotr$1(A, 13) ^ rotr$1(A, 22);
        const T2 = sigma0 + Maj$1(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      SHA256_W$1.fill(0);
    }
    destroy() {
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      this.buffer.fill(0);
    }
  };
  const sha256$1 = /* @__PURE__ */ wrapConstructor$1(() => new SHA256$1());
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const _0n$4 = BigInt(0);
  const _1n$4 = BigInt(1);
  const _2n$2 = BigInt(2);
  const u8a$1 = (a) => a instanceof Uint8Array;
  const hexes$1 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) => i2.toString(16).padStart(2, "0"));
  function bytesToHex$1(bytes2) {
    if (!u8a$1(bytes2))
      throw new Error("Uint8Array expected");
    let hex2 = "";
    for (let i2 = 0; i2 < bytes2.length; i2++) {
      hex2 += hexes$1[bytes2[i2]];
    }
    return hex2;
  }
  function numberToHexUnpadded(num) {
    const hex2 = num.toString(16);
    return hex2.length & 1 ? `0${hex2}` : hex2;
  }
  function hexToNumber(hex2) {
    if (typeof hex2 !== "string")
      throw new Error("hex string expected, got " + typeof hex2);
    return BigInt(hex2 === "" ? "0" : `0x${hex2}`);
  }
  function hexToBytes$1(hex2) {
    if (typeof hex2 !== "string")
      throw new Error("hex string expected, got " + typeof hex2);
    const len = hex2.length;
    if (len % 2)
      throw new Error("padded hex string expected, got unpadded hex of length " + len);
    const array = new Uint8Array(len / 2);
    for (let i2 = 0; i2 < array.length; i2++) {
      const j = i2 * 2;
      const hexByte = hex2.slice(j, j + 2);
      const byte = Number.parseInt(hexByte, 16);
      if (Number.isNaN(byte) || byte < 0)
        throw new Error("Invalid byte sequence");
      array[i2] = byte;
    }
    return array;
  }
  function bytesToNumberBE(bytes2) {
    return hexToNumber(bytesToHex$1(bytes2));
  }
  function bytesToNumberLE(bytes2) {
    if (!u8a$1(bytes2))
      throw new Error("Uint8Array expected");
    return hexToNumber(bytesToHex$1(Uint8Array.from(bytes2).reverse()));
  }
  function numberToBytesBE(n, len) {
    return hexToBytes$1(n.toString(16).padStart(len * 2, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function numberToVarBytesBE(n) {
    return hexToBytes$1(numberToHexUnpadded(n));
  }
  function ensureBytes(title, hex2, expectedLength) {
    let res;
    if (typeof hex2 === "string") {
      try {
        res = hexToBytes$1(hex2);
      } catch (e) {
        throw new Error(`${title} must be valid hex string, got "${hex2}". Cause: ${e}`);
      }
    } else if (u8a$1(hex2)) {
      res = Uint8Array.from(hex2);
    } else {
      throw new Error(`${title} must be hex string or Uint8Array`);
    }
    const len = res.length;
    if (typeof expectedLength === "number" && len !== expectedLength)
      throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
    return res;
  }
  function concatBytes(...arrays) {
    const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
    let pad = 0;
    arrays.forEach((a) => {
      if (!u8a$1(a))
        throw new Error("Uint8Array expected");
      r.set(a, pad);
      pad += a.length;
    });
    return r;
  }
  function equalBytes(b1, b2) {
    if (b1.length !== b2.length)
      return false;
    for (let i2 = 0; i2 < b1.length; i2++)
      if (b1[i2] !== b2[i2])
        return false;
    return true;
  }
  function utf8ToBytes$1(str) {
    if (typeof str !== "string")
      throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function bitLen(n) {
    let len;
    for (len = 0; n > _0n$4; n >>= _1n$4, len += 1)
      ;
    return len;
  }
  function bitGet(n, pos) {
    return n >> BigInt(pos) & _1n$4;
  }
  const bitSet = (n, pos, value) => {
    return n | (value ? _1n$4 : _0n$4) << BigInt(pos);
  };
  const bitMask = (n) => (_2n$2 << BigInt(n - 1)) - _1n$4;
  const u8n = (data) => new Uint8Array(data);
  const u8fr = (arr) => Uint8Array.from(arr);
  function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    if (typeof hashLen !== "number" || hashLen < 2)
      throw new Error("hashLen must be a number");
    if (typeof qByteLen !== "number" || qByteLen < 2)
      throw new Error("qByteLen must be a number");
    if (typeof hmacFn !== "function")
      throw new Error("hmacFn must be a function");
    let v = u8n(hashLen);
    let k = u8n(hashLen);
    let i2 = 0;
    const reset = () => {
      v.fill(1);
      k.fill(0);
      i2 = 0;
    };
    const h = (...b) => hmacFn(k, v, ...b);
    const reseed = (seed = u8n()) => {
      k = h(u8fr([0]), seed);
      v = h();
      if (seed.length === 0)
        return;
      k = h(u8fr([1]), seed);
      v = h();
    };
    const gen = () => {
      if (i2++ >= 1e3)
        throw new Error("drbg: tried 1000 values");
      let len = 0;
      const out = [];
      while (len < qByteLen) {
        v = h();
        const sl = v.slice();
        out.push(sl);
        len += v.length;
      }
      return concatBytes(...out);
    };
    const genUntil = (seed, pred) => {
      reset();
      reseed(seed);
      let res = void 0;
      while (!(res = pred(gen())))
        reseed();
      reset();
      return res;
    };
    return genUntil;
  }
  const validatorFns = {
    bigint: (val) => typeof val === "bigint",
    function: (val) => typeof val === "function",
    boolean: (val) => typeof val === "boolean",
    string: (val) => typeof val === "string",
    stringOrUint8Array: (val) => typeof val === "string" || val instanceof Uint8Array,
    isSafeInteger: (val) => Number.isSafeInteger(val),
    array: (val) => Array.isArray(val),
    field: (val, object) => object.Fp.isValid(val),
    hash: (val) => typeof val === "function" && Number.isSafeInteger(val.outputLen)
  };
  function validateObject(object, validators, optValidators = {}) {
    const checkField = (fieldName, type, isOptional) => {
      const checkVal = validatorFns[type];
      if (typeof checkVal !== "function")
        throw new Error(`Invalid validator "${type}", expected function`);
      const val = object[fieldName];
      if (isOptional && val === void 0)
        return;
      if (!checkVal(val, object)) {
        throw new Error(`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`);
      }
    };
    for (const [fieldName, type] of Object.entries(validators))
      checkField(fieldName, type, false);
    for (const [fieldName, type] of Object.entries(optValidators))
      checkField(fieldName, type, true);
    return object;
  }
  const ut = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    bitGet,
    bitLen,
    bitMask,
    bitSet,
    bytesToHex: bytesToHex$1,
    bytesToNumberBE,
    bytesToNumberLE,
    concatBytes,
    createHmacDrbg,
    ensureBytes,
    equalBytes,
    hexToBytes: hexToBytes$1,
    hexToNumber,
    numberToBytesBE,
    numberToBytesLE,
    numberToHexUnpadded,
    numberToVarBytesBE,
    utf8ToBytes: utf8ToBytes$1,
    validateObject
  }, Symbol.toStringTag, { value: "Module" }));
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const _0n$3 = BigInt(0), _1n$3 = BigInt(1), _2n$1 = BigInt(2), _3n$1 = BigInt(3);
  const _4n = BigInt(4), _5n = BigInt(5), _8n = BigInt(8);
  BigInt(9);
  BigInt(16);
  function mod(a, b) {
    const result = a % b;
    return result >= _0n$3 ? result : b + result;
  }
  function pow(num, power, modulo) {
    if (modulo <= _0n$3 || power < _0n$3)
      throw new Error("Expected power/modulo > 0");
    if (modulo === _1n$3)
      return _0n$3;
    let res = _1n$3;
    while (power > _0n$3) {
      if (power & _1n$3)
        res = res * num % modulo;
      num = num * num % modulo;
      power >>= _1n$3;
    }
    return res;
  }
  function pow2(x, power, modulo) {
    let res = x;
    while (power-- > _0n$3) {
      res *= res;
      res %= modulo;
    }
    return res;
  }
  function invert(number2, modulo) {
    if (number2 === _0n$3 || modulo <= _0n$3) {
      throw new Error(`invert: expected positive integers, got n=${number2} mod=${modulo}`);
    }
    let a = mod(number2, modulo);
    let b = modulo;
    let x = _0n$3, u = _1n$3;
    while (a !== _0n$3) {
      const q = b / a;
      const r = b % a;
      const m = x - u * q;
      b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n$3)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function tonelliShanks(P) {
    const legendreC = (P - _1n$3) / _2n$1;
    let Q, S, Z;
    for (Q = P - _1n$3, S = 0; Q % _2n$1 === _0n$3; Q /= _2n$1, S++)
      ;
    for (Z = _2n$1; Z < P && pow(Z, legendreC, P) !== P - _1n$3; Z++)
      ;
    if (S === 1) {
      const p1div4 = (P + _1n$3) / _4n;
      return function tonelliFast(Fp2, n) {
        const root = Fp2.pow(n, p1div4);
        if (!Fp2.eql(Fp2.sqr(root), n))
          throw new Error("Cannot find square root");
        return root;
      };
    }
    const Q1div2 = (Q + _1n$3) / _2n$1;
    return function tonelliSlow(Fp2, n) {
      if (Fp2.pow(n, legendreC) === Fp2.neg(Fp2.ONE))
        throw new Error("Cannot find square root");
      let r = S;
      let g = Fp2.pow(Fp2.mul(Fp2.ONE, Z), Q);
      let x = Fp2.pow(n, Q1div2);
      let b = Fp2.pow(n, Q);
      while (!Fp2.eql(b, Fp2.ONE)) {
        if (Fp2.eql(b, Fp2.ZERO))
          return Fp2.ZERO;
        let m = 1;
        for (let t2 = Fp2.sqr(b); m < r; m++) {
          if (Fp2.eql(t2, Fp2.ONE))
            break;
          t2 = Fp2.sqr(t2);
        }
        const ge2 = Fp2.pow(g, _1n$3 << BigInt(r - m - 1));
        g = Fp2.sqr(ge2);
        x = Fp2.mul(x, ge2);
        b = Fp2.mul(b, g);
        r = m;
      }
      return x;
    };
  }
  function FpSqrt(P) {
    if (P % _4n === _3n$1) {
      const p1div4 = (P + _1n$3) / _4n;
      return function sqrt3mod4(Fp2, n) {
        const root = Fp2.pow(n, p1div4);
        if (!Fp2.eql(Fp2.sqr(root), n))
          throw new Error("Cannot find square root");
        return root;
      };
    }
    if (P % _8n === _5n) {
      const c1 = (P - _5n) / _8n;
      return function sqrt5mod8(Fp2, n) {
        const n2 = Fp2.mul(n, _2n$1);
        const v = Fp2.pow(n2, c1);
        const nv = Fp2.mul(n, v);
        const i2 = Fp2.mul(Fp2.mul(nv, _2n$1), v);
        const root = Fp2.mul(nv, Fp2.sub(i2, Fp2.ONE));
        if (!Fp2.eql(Fp2.sqr(root), n))
          throw new Error("Cannot find square root");
        return root;
      };
    }
    return tonelliShanks(P);
  }
  const FIELD_FIELDS = [
    "create",
    "isValid",
    "is0",
    "neg",
    "inv",
    "sqrt",
    "sqr",
    "eql",
    "add",
    "sub",
    "mul",
    "pow",
    "div",
    "addN",
    "subN",
    "mulN",
    "sqrN"
  ];
  function validateField(field) {
    const initial = {
      ORDER: "bigint",
      MASK: "bigint",
      BYTES: "isSafeInteger",
      BITS: "isSafeInteger"
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
      map[val] = "function";
      return map;
    }, initial);
    return validateObject(field, opts);
  }
  function FpPow(f, num, power) {
    if (power < _0n$3)
      throw new Error("Expected power > 0");
    if (power === _0n$3)
      return f.ONE;
    if (power === _1n$3)
      return num;
    let p = f.ONE;
    let d = num;
    while (power > _0n$3) {
      if (power & _1n$3)
        p = f.mul(p, d);
      d = f.sqr(d);
      power >>= _1n$3;
    }
    return p;
  }
  function FpInvertBatch(f, nums) {
    const tmp = new Array(nums.length);
    const lastMultiplied = nums.reduce((acc, num, i2) => {
      if (f.is0(num))
        return acc;
      tmp[i2] = acc;
      return f.mul(acc, num);
    }, f.ONE);
    const inverted = f.inv(lastMultiplied);
    nums.reduceRight((acc, num, i2) => {
      if (f.is0(num))
        return acc;
      tmp[i2] = f.mul(acc, tmp[i2]);
      return f.mul(acc, num);
    }, inverted);
    return tmp;
  }
  function nLength(n, nBitLength) {
    const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  function Field(ORDER, bitLen2, isLE2 = false, redef = {}) {
    if (ORDER <= _0n$3)
      throw new Error(`Expected Field ORDER > 0, got ${ORDER}`);
    const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen2);
    if (BYTES > 2048)
      throw new Error("Field lengths over 2048 bytes are not supported");
    const sqrtP = FpSqrt(ORDER);
    const f = Object.freeze({
      ORDER,
      BITS,
      BYTES,
      MASK: bitMask(BITS),
      ZERO: _0n$3,
      ONE: _1n$3,
      create: (num) => mod(num, ORDER),
      isValid: (num) => {
        if (typeof num !== "bigint")
          throw new Error(`Invalid field element: expected bigint, got ${typeof num}`);
        return _0n$3 <= num && num < ORDER;
      },
      is0: (num) => num === _0n$3,
      isOdd: (num) => (num & _1n$3) === _1n$3,
      neg: (num) => mod(-num, ORDER),
      eql: (lhs, rhs) => lhs === rhs,
      sqr: (num) => mod(num * num, ORDER),
      add: (lhs, rhs) => mod(lhs + rhs, ORDER),
      sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
      mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
      pow: (num, power) => FpPow(f, num, power),
      div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
      // Same as above, but doesn't normalize
      sqrN: (num) => num * num,
      addN: (lhs, rhs) => lhs + rhs,
      subN: (lhs, rhs) => lhs - rhs,
      mulN: (lhs, rhs) => lhs * rhs,
      inv: (num) => invert(num, ORDER),
      sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
      invertBatch: (lst) => FpInvertBatch(f, lst),
      // TODO: do we really need constant cmov?
      // We don't have const-time bigints anyway, so probably will be not very useful
      cmov: (a, b, c) => c ? b : a,
      toBytes: (num) => isLE2 ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
      fromBytes: (bytes2) => {
        if (bytes2.length !== BYTES)
          throw new Error(`Fp.fromBytes: expected ${BYTES}, got ${bytes2.length}`);
        return isLE2 ? bytesToNumberLE(bytes2) : bytesToNumberBE(bytes2);
      }
    });
    return Object.freeze(f);
  }
  function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== "bigint")
      throw new Error("field order must be bigint");
    const bitLength = fieldOrder.toString(2).length;
    return Math.ceil(bitLength / 8);
  }
  function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
  }
  function mapHashToField(key, fieldOrder, isLE2 = false) {
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = getMinHashLength(fieldOrder);
    if (len < 16 || len < minLen || len > 1024)
      throw new Error(`expected ${minLen}-1024 bytes of input, got ${len}`);
    const num = isLE2 ? bytesToNumberBE(key) : bytesToNumberLE(key);
    const reduced = mod(num, fieldOrder - _1n$3) + _1n$3;
    return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
  }
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const _0n$2 = BigInt(0);
  const _1n$2 = BigInt(1);
  function wNAF(c, bits) {
    const constTimeNegate = (condition, item) => {
      const neg = item.negate();
      return condition ? neg : item;
    };
    const opts = (W) => {
      const windows = Math.ceil(bits / W) + 1;
      const windowSize = 2 ** (W - 1);
      return { windows, windowSize };
    };
    return {
      constTimeNegate,
      // non-const time multiplication ladder
      unsafeLadder(elm, n) {
        let p = c.ZERO;
        let d = elm;
        while (n > _0n$2) {
          if (n & _1n$2)
            p = p.add(d);
          d = d.double();
          n >>= _1n$2;
        }
        return p;
      },
      /**
       * Creates a wNAF precomputation window. Used for caching.
       * Default window size is set by `utils.precompute()` and is equal to 8.
       * Number of precomputed points depends on the curve size:
       * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
       * - 𝑊 is the window size
       * - 𝑛 is the bitlength of the curve order.
       * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
       * @returns precomputed point tables flattened to a single array
       */
      precomputeWindow(elm, W) {
        const { windows, windowSize } = opts(W);
        const points = [];
        let p = elm;
        let base = p;
        for (let window2 = 0; window2 < windows; window2++) {
          base = p;
          points.push(base);
          for (let i2 = 1; i2 < windowSize; i2++) {
            base = base.add(p);
            points.push(base);
          }
          p = base.double();
        }
        return points;
      },
      /**
       * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
       * @param W window size
       * @param precomputes precomputed tables
       * @param n scalar (we don't check here, but should be less than curve order)
       * @returns real and fake (for const-time) points
       */
      wNAF(W, precomputes, n) {
        const { windows, windowSize } = opts(W);
        let p = c.ZERO;
        let f = c.BASE;
        const mask = BigInt(2 ** W - 1);
        const maxNumber = 2 ** W;
        const shiftBy = BigInt(W);
        for (let window2 = 0; window2 < windows; window2++) {
          const offset = window2 * windowSize;
          let wbits = Number(n & mask);
          n >>= shiftBy;
          if (wbits > windowSize) {
            wbits -= maxNumber;
            n += _1n$2;
          }
          const offset1 = offset;
          const offset2 = offset + Math.abs(wbits) - 1;
          const cond1 = window2 % 2 !== 0;
          const cond2 = wbits < 0;
          if (wbits === 0) {
            f = f.add(constTimeNegate(cond1, precomputes[offset1]));
          } else {
            p = p.add(constTimeNegate(cond2, precomputes[offset2]));
          }
        }
        return { p, f };
      },
      wNAFCached(P, precomputesMap, n, transform) {
        const W = P._WINDOW_SIZE || 1;
        let comp = precomputesMap.get(P);
        if (!comp) {
          comp = this.precomputeWindow(P, W);
          if (W !== 1) {
            precomputesMap.set(P, transform(comp));
          }
        }
        return this.wNAF(W, comp, n);
      }
    };
  }
  function validateBasic(curve) {
    validateField(curve.Fp);
    validateObject(curve, {
      n: "bigint",
      h: "bigint",
      Gx: "field",
      Gy: "field"
    }, {
      nBitLength: "isSafeInteger",
      nByteLength: "isSafeInteger"
    });
    return Object.freeze({
      ...nLength(curve.n, curve.nBitLength),
      ...curve,
      ...{ p: curve.Fp.ORDER }
    });
  }
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  function validatePointOpts(curve) {
    const opts = validateBasic(curve);
    validateObject(opts, {
      a: "field",
      b: "field"
    }, {
      allowedPrivateKeyLengths: "array",
      wrapPrivateKey: "boolean",
      isTorsionFree: "function",
      clearCofactor: "function",
      allowInfinityPoint: "boolean",
      fromBytes: "function",
      toBytes: "function"
    });
    const { endo, Fp: Fp2, a } = opts;
    if (endo) {
      if (!Fp2.eql(a, Fp2.ZERO)) {
        throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");
      }
      if (typeof endo !== "object" || typeof endo.beta !== "bigint" || typeof endo.splitScalar !== "function") {
        throw new Error("Expected endomorphism with beta: bigint and splitScalar: function");
      }
    }
    return Object.freeze({ ...opts });
  }
  const { bytesToNumberBE: b2n, hexToBytes: h2b } = ut;
  const DER = {
    // asn.1 DER encoding utils
    Err: class DERErr extends Error {
      constructor(m = "") {
        super(m);
      }
    },
    _parseInt(data) {
      const { Err: E } = DER;
      if (data.length < 2 || data[0] !== 2)
        throw new E("Invalid signature integer tag");
      const len = data[1];
      const res = data.subarray(2, len + 2);
      if (!len || res.length !== len)
        throw new E("Invalid signature integer: wrong length");
      if (res[0] & 128)
        throw new E("Invalid signature integer: negative");
      if (res[0] === 0 && !(res[1] & 128))
        throw new E("Invalid signature integer: unnecessary leading zero");
      return { d: b2n(res), l: data.subarray(len + 2) };
    },
    toSig(hex2) {
      const { Err: E } = DER;
      const data = typeof hex2 === "string" ? h2b(hex2) : hex2;
      if (!(data instanceof Uint8Array))
        throw new Error("ui8a expected");
      let l = data.length;
      if (l < 2 || data[0] != 48)
        throw new E("Invalid signature tag");
      if (data[1] !== l - 2)
        throw new E("Invalid signature: incorrect length");
      const { d: r, l: sBytes } = DER._parseInt(data.subarray(2));
      const { d: s, l: rBytesLeft } = DER._parseInt(sBytes);
      if (rBytesLeft.length)
        throw new E("Invalid signature: left bytes after parsing");
      return { r, s };
    },
    hexFromSig(sig) {
      const slice = (s2) => Number.parseInt(s2[0], 16) & 8 ? "00" + s2 : s2;
      const h = (num) => {
        const hex2 = num.toString(16);
        return hex2.length & 1 ? `0${hex2}` : hex2;
      };
      const s = slice(h(sig.s));
      const r = slice(h(sig.r));
      const shl = s.length / 2;
      const rhl = r.length / 2;
      const sl = h(shl);
      const rl = h(rhl);
      return `30${h(rhl + shl + 4)}02${rl}${r}02${sl}${s}`;
    }
  };
  const _0n$1 = BigInt(0), _1n$1 = BigInt(1);
  BigInt(2);
  const _3n = BigInt(3);
  BigInt(4);
  function weierstrassPoints(opts) {
    const CURVE = validatePointOpts(opts);
    const { Fp: Fp2 } = CURVE;
    const toBytes2 = CURVE.toBytes || ((_c, point, _isCompressed) => {
      const a = point.toAffine();
      return concatBytes(Uint8Array.from([4]), Fp2.toBytes(a.x), Fp2.toBytes(a.y));
    });
    const fromBytes = CURVE.fromBytes || ((bytes2) => {
      const tail = bytes2.subarray(1);
      const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
      const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
      return { x, y };
    });
    function weierstrassEquation(x) {
      const { a, b } = CURVE;
      const x2 = Fp2.sqr(x);
      const x3 = Fp2.mul(x2, x);
      return Fp2.add(Fp2.add(x3, Fp2.mul(x, a)), b);
    }
    if (!Fp2.eql(Fp2.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
      throw new Error("bad generator point: equation left != right");
    function isWithinCurveOrder(num) {
      return typeof num === "bigint" && _0n$1 < num && num < CURVE.n;
    }
    function assertGE(num) {
      if (!isWithinCurveOrder(num))
        throw new Error("Expected valid bigint: 0 < bigint < curve.n");
    }
    function normPrivateKeyToScalar(key) {
      const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n } = CURVE;
      if (lengths && typeof key !== "bigint") {
        if (key instanceof Uint8Array)
          key = bytesToHex$1(key);
        if (typeof key !== "string" || !lengths.includes(key.length))
          throw new Error("Invalid key");
        key = key.padStart(nByteLength * 2, "0");
      }
      let num;
      try {
        num = typeof key === "bigint" ? key : bytesToNumberBE(ensureBytes("private key", key, nByteLength));
      } catch (error) {
        throw new Error(`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`);
      }
      if (wrapPrivateKey)
        num = mod(num, n);
      assertGE(num);
      return num;
    }
    const pointPrecomputes = /* @__PURE__ */ new Map();
    function assertPrjPoint(other) {
      if (!(other instanceof Point2))
        throw new Error("ProjectivePoint expected");
    }
    class Point2 {
      constructor(px, py, pz) {
        this.px = px;
        this.py = py;
        this.pz = pz;
        if (px == null || !Fp2.isValid(px))
          throw new Error("x required");
        if (py == null || !Fp2.isValid(py))
          throw new Error("y required");
        if (pz == null || !Fp2.isValid(pz))
          throw new Error("z required");
      }
      // Does not validate if the point is on-curve.
      // Use fromHex instead, or call assertValidity() later.
      static fromAffine(p) {
        const { x, y } = p || {};
        if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
          throw new Error("invalid affine point");
        if (p instanceof Point2)
          throw new Error("projective point not allowed");
        const is0 = (i2) => Fp2.eql(i2, Fp2.ZERO);
        if (is0(x) && is0(y))
          return Point2.ZERO;
        return new Point2(x, y, Fp2.ONE);
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      /**
       * Takes a bunch of Projective Points but executes only one
       * inversion on all of them. Inversion is very slow operation,
       * so this improves performance massively.
       * Optimization: converts a list of projective points to a list of identical points with Z=1.
       */
      static normalizeZ(points) {
        const toInv = Fp2.invertBatch(points.map((p) => p.pz));
        return points.map((p, i2) => p.toAffine(toInv[i2])).map(Point2.fromAffine);
      }
      /**
       * Converts hash string or Uint8Array to Point.
       * @param hex short/long ECDSA hex
       */
      static fromHex(hex2) {
        const P = Point2.fromAffine(fromBytes(ensureBytes("pointHex", hex2)));
        P.assertValidity();
        return P;
      }
      // Multiplies generator point by privateKey.
      static fromPrivateKey(privateKey) {
        return Point2.BASE.multiply(normPrivateKeyToScalar(privateKey));
      }
      // "Private method", don't use it directly
      _setWindowSize(windowSize) {
        this._WINDOW_SIZE = windowSize;
        pointPrecomputes.delete(this);
      }
      // A point on curve is valid if it conforms to equation.
      assertValidity() {
        if (this.is0()) {
          if (CURVE.allowInfinityPoint && !Fp2.is0(this.py))
            return;
          throw new Error("bad point: ZERO");
        }
        const { x, y } = this.toAffine();
        if (!Fp2.isValid(x) || !Fp2.isValid(y))
          throw new Error("bad point: x or y not FE");
        const left = Fp2.sqr(y);
        const right = weierstrassEquation(x);
        if (!Fp2.eql(left, right))
          throw new Error("bad point: equation left != right");
        if (!this.isTorsionFree())
          throw new Error("bad point: not in prime-order subgroup");
      }
      hasEvenY() {
        const { y } = this.toAffine();
        if (Fp2.isOdd)
          return !Fp2.isOdd(y);
        throw new Error("Field doesn't support isOdd");
      }
      /**
       * Compare one point to another.
       */
      equals(other) {
        assertPrjPoint(other);
        const { px: X1, py: Y1, pz: Z1 } = this;
        const { px: X2, py: Y2, pz: Z2 } = other;
        const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
        const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
        return U1 && U2;
      }
      /**
       * Flips point to one corresponding to (x, -y) in Affine coordinates.
       */
      negate() {
        return new Point2(this.px, Fp2.neg(this.py), this.pz);
      }
      // Renes-Costello-Batina exception-free doubling formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 3
      // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
      double() {
        const { a, b } = CURVE;
        const b3 = Fp2.mul(b, _3n);
        const { px: X1, py: Y1, pz: Z1 } = this;
        let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
        let t0 = Fp2.mul(X1, X1);
        let t1 = Fp2.mul(Y1, Y1);
        let t2 = Fp2.mul(Z1, Z1);
        let t3 = Fp2.mul(X1, Y1);
        t3 = Fp2.add(t3, t3);
        Z3 = Fp2.mul(X1, Z1);
        Z3 = Fp2.add(Z3, Z3);
        X3 = Fp2.mul(a, Z3);
        Y3 = Fp2.mul(b3, t2);
        Y3 = Fp2.add(X3, Y3);
        X3 = Fp2.sub(t1, Y3);
        Y3 = Fp2.add(t1, Y3);
        Y3 = Fp2.mul(X3, Y3);
        X3 = Fp2.mul(t3, X3);
        Z3 = Fp2.mul(b3, Z3);
        t2 = Fp2.mul(a, t2);
        t3 = Fp2.sub(t0, t2);
        t3 = Fp2.mul(a, t3);
        t3 = Fp2.add(t3, Z3);
        Z3 = Fp2.add(t0, t0);
        t0 = Fp2.add(Z3, t0);
        t0 = Fp2.add(t0, t2);
        t0 = Fp2.mul(t0, t3);
        Y3 = Fp2.add(Y3, t0);
        t2 = Fp2.mul(Y1, Z1);
        t2 = Fp2.add(t2, t2);
        t0 = Fp2.mul(t2, t3);
        X3 = Fp2.sub(X3, t0);
        Z3 = Fp2.mul(t2, t1);
        Z3 = Fp2.add(Z3, Z3);
        Z3 = Fp2.add(Z3, Z3);
        return new Point2(X3, Y3, Z3);
      }
      // Renes-Costello-Batina exception-free addition formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 1
      // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
      add(other) {
        assertPrjPoint(other);
        const { px: X1, py: Y1, pz: Z1 } = this;
        const { px: X2, py: Y2, pz: Z2 } = other;
        let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
        const a = CURVE.a;
        const b3 = Fp2.mul(CURVE.b, _3n);
        let t0 = Fp2.mul(X1, X2);
        let t1 = Fp2.mul(Y1, Y2);
        let t2 = Fp2.mul(Z1, Z2);
        let t3 = Fp2.add(X1, Y1);
        let t4 = Fp2.add(X2, Y2);
        t3 = Fp2.mul(t3, t4);
        t4 = Fp2.add(t0, t1);
        t3 = Fp2.sub(t3, t4);
        t4 = Fp2.add(X1, Z1);
        let t5 = Fp2.add(X2, Z2);
        t4 = Fp2.mul(t4, t5);
        t5 = Fp2.add(t0, t2);
        t4 = Fp2.sub(t4, t5);
        t5 = Fp2.add(Y1, Z1);
        X3 = Fp2.add(Y2, Z2);
        t5 = Fp2.mul(t5, X3);
        X3 = Fp2.add(t1, t2);
        t5 = Fp2.sub(t5, X3);
        Z3 = Fp2.mul(a, t4);
        X3 = Fp2.mul(b3, t2);
        Z3 = Fp2.add(X3, Z3);
        X3 = Fp2.sub(t1, Z3);
        Z3 = Fp2.add(t1, Z3);
        Y3 = Fp2.mul(X3, Z3);
        t1 = Fp2.add(t0, t0);
        t1 = Fp2.add(t1, t0);
        t2 = Fp2.mul(a, t2);
        t4 = Fp2.mul(b3, t4);
        t1 = Fp2.add(t1, t2);
        t2 = Fp2.sub(t0, t2);
        t2 = Fp2.mul(a, t2);
        t4 = Fp2.add(t4, t2);
        t0 = Fp2.mul(t1, t4);
        Y3 = Fp2.add(Y3, t0);
        t0 = Fp2.mul(t5, t4);
        X3 = Fp2.mul(t3, X3);
        X3 = Fp2.sub(X3, t0);
        t0 = Fp2.mul(t3, t1);
        Z3 = Fp2.mul(t5, Z3);
        Z3 = Fp2.add(Z3, t0);
        return new Point2(X3, Y3, Z3);
      }
      subtract(other) {
        return this.add(other.negate());
      }
      is0() {
        return this.equals(Point2.ZERO);
      }
      wNAF(n) {
        return wnaf.wNAFCached(this, pointPrecomputes, n, (comp) => {
          const toInv = Fp2.invertBatch(comp.map((p) => p.pz));
          return comp.map((p, i2) => p.toAffine(toInv[i2])).map(Point2.fromAffine);
        });
      }
      /**
       * Non-constant-time multiplication. Uses double-and-add algorithm.
       * It's faster, but should only be used when you don't care about
       * an exposed private key e.g. sig verification, which works over *public* keys.
       */
      multiplyUnsafe(n) {
        const I = Point2.ZERO;
        if (n === _0n$1)
          return I;
        assertGE(n);
        if (n === _1n$1)
          return this;
        const { endo } = CURVE;
        if (!endo)
          return wnaf.unsafeLadder(this, n);
        let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
        let k1p = I;
        let k2p = I;
        let d = this;
        while (k1 > _0n$1 || k2 > _0n$1) {
          if (k1 & _1n$1)
            k1p = k1p.add(d);
          if (k2 & _1n$1)
            k2p = k2p.add(d);
          d = d.double();
          k1 >>= _1n$1;
          k2 >>= _1n$1;
        }
        if (k1neg)
          k1p = k1p.negate();
        if (k2neg)
          k2p = k2p.negate();
        k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
        return k1p.add(k2p);
      }
      /**
       * Constant time multiplication.
       * Uses wNAF method. Windowed method may be 10% faster,
       * but takes 2x longer to generate and consumes 2x memory.
       * Uses precomputes when available.
       * Uses endomorphism for Koblitz curves.
       * @param scalar by which the point would be multiplied
       * @returns New point
       */
      multiply(scalar) {
        assertGE(scalar);
        let n = scalar;
        let point, fake;
        const { endo } = CURVE;
        if (endo) {
          const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
          let { p: k1p, f: f1p } = this.wNAF(k1);
          let { p: k2p, f: f2p } = this.wNAF(k2);
          k1p = wnaf.constTimeNegate(k1neg, k1p);
          k2p = wnaf.constTimeNegate(k2neg, k2p);
          k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
          point = k1p.add(k2p);
          fake = f1p.add(f2p);
        } else {
          const { p, f } = this.wNAF(n);
          point = p;
          fake = f;
        }
        return Point2.normalizeZ([point, fake])[0];
      }
      /**
       * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
       * Not using Strauss-Shamir trick: precomputation tables are faster.
       * The trick could be useful if both P and Q are not G (not in our case).
       * @returns non-zero affine point
       */
      multiplyAndAddUnsafe(Q, a, b) {
        const G = Point2.BASE;
        const mul = (P, a2) => a2 === _0n$1 || a2 === _1n$1 || !P.equals(G) ? P.multiplyUnsafe(a2) : P.multiply(a2);
        const sum = mul(this, a).add(mul(Q, b));
        return sum.is0() ? void 0 : sum;
      }
      // Converts Projective point to affine (x, y) coordinates.
      // Can accept precomputed Z^-1 - for example, from invertBatch.
      // (x, y, z) ∋ (x=x/z, y=y/z)
      toAffine(iz) {
        const { px: x, py: y, pz: z } = this;
        const is0 = this.is0();
        if (iz == null)
          iz = is0 ? Fp2.ONE : Fp2.inv(z);
        const ax = Fp2.mul(x, iz);
        const ay = Fp2.mul(y, iz);
        const zz = Fp2.mul(z, iz);
        if (is0)
          return { x: Fp2.ZERO, y: Fp2.ZERO };
        if (!Fp2.eql(zz, Fp2.ONE))
          throw new Error("invZ was invalid");
        return { x: ax, y: ay };
      }
      isTorsionFree() {
        const { h: cofactor, isTorsionFree } = CURVE;
        if (cofactor === _1n$1)
          return true;
        if (isTorsionFree)
          return isTorsionFree(Point2, this);
        throw new Error("isTorsionFree() has not been declared for the elliptic curve");
      }
      clearCofactor() {
        const { h: cofactor, clearCofactor } = CURVE;
        if (cofactor === _1n$1)
          return this;
        if (clearCofactor)
          return clearCofactor(Point2, this);
        return this.multiplyUnsafe(CURVE.h);
      }
      toRawBytes(isCompressed = true) {
        this.assertValidity();
        return toBytes2(Point2, this, isCompressed);
      }
      toHex(isCompressed = true) {
        return bytesToHex$1(this.toRawBytes(isCompressed));
      }
    }
    Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp2.ONE);
    Point2.ZERO = new Point2(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
    const _bits = CURVE.nBitLength;
    const wnaf = wNAF(Point2, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
    return {
      CURVE,
      ProjectivePoint: Point2,
      normPrivateKeyToScalar,
      weierstrassEquation,
      isWithinCurveOrder
    };
  }
  function validateOpts(curve) {
    const opts = validateBasic(curve);
    validateObject(opts, {
      hash: "hash",
      hmac: "function",
      randomBytes: "function"
    }, {
      bits2int: "function",
      bits2int_modN: "function",
      lowS: "boolean"
    });
    return Object.freeze({ lowS: true, ...opts });
  }
  function weierstrass(curveDef) {
    const CURVE = validateOpts(curveDef);
    const { Fp: Fp2, n: CURVE_ORDER } = CURVE;
    const compressedLen = Fp2.BYTES + 1;
    const uncompressedLen = 2 * Fp2.BYTES + 1;
    function isValidFieldElement(num) {
      return _0n$1 < num && num < Fp2.ORDER;
    }
    function modN2(a) {
      return mod(a, CURVE_ORDER);
    }
    function invN(a) {
      return invert(a, CURVE_ORDER);
    }
    const { ProjectivePoint: Point2, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder } = weierstrassPoints({
      ...CURVE,
      toBytes(_c, point, isCompressed) {
        const a = point.toAffine();
        const x = Fp2.toBytes(a.x);
        const cat = concatBytes;
        if (isCompressed) {
          return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
        } else {
          return cat(Uint8Array.from([4]), x, Fp2.toBytes(a.y));
        }
      },
      fromBytes(bytes2) {
        const len = bytes2.length;
        const head = bytes2[0];
        const tail = bytes2.subarray(1);
        if (len === compressedLen && (head === 2 || head === 3)) {
          const x = bytesToNumberBE(tail);
          if (!isValidFieldElement(x))
            throw new Error("Point is not on curve");
          const y2 = weierstrassEquation(x);
          let y = Fp2.sqrt(y2);
          const isYOdd = (y & _1n$1) === _1n$1;
          const isHeadOdd = (head & 1) === 1;
          if (isHeadOdd !== isYOdd)
            y = Fp2.neg(y);
          return { x, y };
        } else if (len === uncompressedLen && head === 4) {
          const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
          const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
          return { x, y };
        } else {
          throw new Error(`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`);
        }
      }
    });
    const numToNByteStr = (num) => bytesToHex$1(numberToBytesBE(num, CURVE.nByteLength));
    function isBiggerThanHalfOrder(number2) {
      const HALF = CURVE_ORDER >> _1n$1;
      return number2 > HALF;
    }
    function normalizeS(s) {
      return isBiggerThanHalfOrder(s) ? modN2(-s) : s;
    }
    const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));
    class Signature {
      constructor(r, s, recovery) {
        this.r = r;
        this.s = s;
        this.recovery = recovery;
        this.assertValidity();
      }
      // pair (bytes of r, bytes of s)
      static fromCompact(hex2) {
        const l = CURVE.nByteLength;
        hex2 = ensureBytes("compactSignature", hex2, l * 2);
        return new Signature(slcNum(hex2, 0, l), slcNum(hex2, l, 2 * l));
      }
      // DER encoded ECDSA signature
      // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
      static fromDER(hex2) {
        const { r, s } = DER.toSig(ensureBytes("DER", hex2));
        return new Signature(r, s);
      }
      assertValidity() {
        if (!isWithinCurveOrder(this.r))
          throw new Error("r must be 0 < r < CURVE.n");
        if (!isWithinCurveOrder(this.s))
          throw new Error("s must be 0 < s < CURVE.n");
      }
      addRecoveryBit(recovery) {
        return new Signature(this.r, this.s, recovery);
      }
      recoverPublicKey(msgHash) {
        const { r, s, recovery: rec } = this;
        const h = bits2int_modN(ensureBytes("msgHash", msgHash));
        if (rec == null || ![0, 1, 2, 3].includes(rec))
          throw new Error("recovery id invalid");
        const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
        if (radj >= Fp2.ORDER)
          throw new Error("recovery id 2 or 3 invalid");
        const prefix = (rec & 1) === 0 ? "02" : "03";
        const R = Point2.fromHex(prefix + numToNByteStr(radj));
        const ir = invN(radj);
        const u1 = modN2(-h * ir);
        const u2 = modN2(s * ir);
        const Q = Point2.BASE.multiplyAndAddUnsafe(R, u1, u2);
        if (!Q)
          throw new Error("point at infinify");
        Q.assertValidity();
        return Q;
      }
      // Signatures should be low-s, to prevent malleability.
      hasHighS() {
        return isBiggerThanHalfOrder(this.s);
      }
      normalizeS() {
        return this.hasHighS() ? new Signature(this.r, modN2(-this.s), this.recovery) : this;
      }
      // DER-encoded
      toDERRawBytes() {
        return hexToBytes$1(this.toDERHex());
      }
      toDERHex() {
        return DER.hexFromSig({ r: this.r, s: this.s });
      }
      // padded bytes of r, then padded bytes of s
      toCompactRawBytes() {
        return hexToBytes$1(this.toCompactHex());
      }
      toCompactHex() {
        return numToNByteStr(this.r) + numToNByteStr(this.s);
      }
    }
    const utils = {
      isValidPrivateKey(privateKey) {
        try {
          normPrivateKeyToScalar(privateKey);
          return true;
        } catch (error) {
          return false;
        }
      },
      normPrivateKeyToScalar,
      /**
       * Produces cryptographically secure private key from random of size
       * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
       */
      randomPrivateKey: () => {
        const length = getMinHashLength(CURVE.n);
        return mapHashToField(CURVE.randomBytes(length), CURVE.n);
      },
      /**
       * Creates precompute table for an arbitrary EC point. Makes point "cached".
       * Allows to massively speed-up `point.multiply(scalar)`.
       * @returns cached point
       * @example
       * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
       * fast.multiply(privKey); // much faster ECDH now
       */
      precompute(windowSize = 8, point = Point2.BASE) {
        point._setWindowSize(windowSize);
        point.multiply(BigInt(3));
        return point;
      }
    };
    function getPublicKey(privateKey, isCompressed = true) {
      return Point2.fromPrivateKey(privateKey).toRawBytes(isCompressed);
    }
    function isProbPub(item) {
      const arr = item instanceof Uint8Array;
      const str = typeof item === "string";
      const len = (arr || str) && item.length;
      if (arr)
        return len === compressedLen || len === uncompressedLen;
      if (str)
        return len === 2 * compressedLen || len === 2 * uncompressedLen;
      if (item instanceof Point2)
        return true;
      return false;
    }
    function getSharedSecret(privateA, publicB, isCompressed = true) {
      if (isProbPub(privateA))
        throw new Error("first arg must be private key");
      if (!isProbPub(publicB))
        throw new Error("second arg must be public key");
      const b = Point2.fromHex(publicB);
      return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
    }
    const bits2int = CURVE.bits2int || function(bytes2) {
      const num = bytesToNumberBE(bytes2);
      const delta = bytes2.length * 8 - CURVE.nBitLength;
      return delta > 0 ? num >> BigInt(delta) : num;
    };
    const bits2int_modN = CURVE.bits2int_modN || function(bytes2) {
      return modN2(bits2int(bytes2));
    };
    const ORDER_MASK = bitMask(CURVE.nBitLength);
    function int2octets(num) {
      if (typeof num !== "bigint")
        throw new Error("bigint expected");
      if (!(_0n$1 <= num && num < ORDER_MASK))
        throw new Error(`bigint expected < 2^${CURVE.nBitLength}`);
      return numberToBytesBE(num, CURVE.nByteLength);
    }
    function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
      if (["recovered", "canonical"].some((k) => k in opts))
        throw new Error("sign() legacy options not supported");
      const { hash: hash2, randomBytes: randomBytes2 } = CURVE;
      let { lowS, prehash, extraEntropy: ent } = opts;
      if (lowS == null)
        lowS = true;
      msgHash = ensureBytes("msgHash", msgHash);
      if (prehash)
        msgHash = ensureBytes("prehashed msgHash", hash2(msgHash));
      const h1int = bits2int_modN(msgHash);
      const d = normPrivateKeyToScalar(privateKey);
      const seedArgs = [int2octets(d), int2octets(h1int)];
      if (ent != null) {
        const e = ent === true ? randomBytes2(Fp2.BYTES) : ent;
        seedArgs.push(ensureBytes("extraEntropy", e));
      }
      const seed = concatBytes(...seedArgs);
      const m = h1int;
      function k2sig(kBytes) {
        const k = bits2int(kBytes);
        if (!isWithinCurveOrder(k))
          return;
        const ik = invN(k);
        const q = Point2.BASE.multiply(k).toAffine();
        const r = modN2(q.x);
        if (r === _0n$1)
          return;
        const s = modN2(ik * modN2(m + r * d));
        if (s === _0n$1)
          return;
        let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n$1);
        let normS = s;
        if (lowS && isBiggerThanHalfOrder(s)) {
          normS = normalizeS(s);
          recovery ^= 1;
        }
        return new Signature(r, normS, recovery);
      }
      return { seed, k2sig };
    }
    const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
    const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
    function sign2(msgHash, privKey, opts = defaultSigOpts) {
      const { seed, k2sig } = prepSig(msgHash, privKey, opts);
      const C = CURVE;
      const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
      return drbg(seed, k2sig);
    }
    Point2.BASE._setWindowSize(8);
    function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
      var _a2;
      const sg = signature;
      msgHash = ensureBytes("msgHash", msgHash);
      publicKey = ensureBytes("publicKey", publicKey);
      if ("strict" in opts)
        throw new Error("options.strict was renamed to lowS");
      const { lowS, prehash } = opts;
      let _sig = void 0;
      let P;
      try {
        if (typeof sg === "string" || sg instanceof Uint8Array) {
          try {
            _sig = Signature.fromDER(sg);
          } catch (derError) {
            if (!(derError instanceof DER.Err))
              throw derError;
            _sig = Signature.fromCompact(sg);
          }
        } else if (typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint") {
          const { r: r2, s: s2 } = sg;
          _sig = new Signature(r2, s2);
        } else {
          throw new Error("PARSE");
        }
        P = Point2.fromHex(publicKey);
      } catch (error) {
        if (error.message === "PARSE")
          throw new Error(`signature must be Signature instance, Uint8Array or hex string`);
        return false;
      }
      if (lowS && _sig.hasHighS())
        return false;
      if (prehash)
        msgHash = CURVE.hash(msgHash);
      const { r, s } = _sig;
      const h = bits2int_modN(msgHash);
      const is = invN(s);
      const u1 = modN2(h * is);
      const u2 = modN2(r * is);
      const R = (_a2 = Point2.BASE.multiplyAndAddUnsafe(P, u1, u2)) == null ? void 0 : _a2.toAffine();
      if (!R)
        return false;
      const v = modN2(R.x);
      return v === r;
    }
    return {
      CURVE,
      getPublicKey,
      getSharedSecret,
      sign: sign2,
      verify,
      ProjectivePoint: Point2,
      Signature,
      utils
    };
  }
  class HMAC extends Hash$1 {
    constructor(hash2, _key) {
      super();
      this.finished = false;
      this.destroyed = false;
      hash$1(hash2);
      const key = toBytes$1(_key);
      this.iHash = hash2.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
      for (let i2 = 0; i2 < pad.length; i2++)
        pad[i2] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash2.create();
      for (let i2 = 0; i2 < pad.length; i2++)
        pad[i2] ^= 54 ^ 92;
      this.oHash.update(pad);
      pad.fill(0);
    }
    update(buf) {
      exists$1(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      exists$1(this);
      bytes$1(out, this.outputLen);
      this.finished = true;
      this.iHash.digestInto(out);
      this.oHash.update(out);
      this.oHash.digestInto(out);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to || (to = Object.create(Object.getPrototypeOf(this), {}));
      const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  }
  const hmac = (hash2, key, message) => new HMAC(hash2, key).update(message).digest();
  hmac.create = (hash2, key) => new HMAC(hash2, key);
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  function getHash(hash2) {
    return {
      hash: hash2,
      hmac: (key, ...msgs) => hmac(hash2, key, concatBytes$1(...msgs)),
      randomBytes
    };
  }
  function createCurve(curveDef, defHash) {
    const create = (hash2) => weierstrass({ ...curveDef, ...getHash(hash2) });
    return Object.freeze({ ...create(defHash), create });
  }
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const secp256k1P = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
  const secp256k1N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
  const _1n = BigInt(1);
  const _2n = BigInt(2);
  const divNearest = (a, b) => (a + b / _2n) / b;
  function sqrtMod(y) {
    const P = secp256k1P;
    const _3n2 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = y * y * y % P;
    const b3 = b2 * b2 * y % P;
    const b6 = pow2(b3, _3n2, P) * b3 % P;
    const b9 = pow2(b6, _3n2, P) * b3 % P;
    const b11 = pow2(b9, _2n, P) * b2 % P;
    const b22 = pow2(b11, _11n, P) * b11 % P;
    const b44 = pow2(b22, _22n, P) * b22 % P;
    const b88 = pow2(b44, _44n, P) * b44 % P;
    const b176 = pow2(b88, _88n, P) * b88 % P;
    const b220 = pow2(b176, _44n, P) * b44 % P;
    const b223 = pow2(b220, _3n2, P) * b3 % P;
    const t1 = pow2(b223, _23n, P) * b22 % P;
    const t2 = pow2(t1, _6n, P) * b2 % P;
    const root = pow2(t2, _2n, P);
    if (!Fp.eql(Fp.sqr(root), y))
      throw new Error("Cannot find square root");
    return root;
  }
  const Fp = Field(secp256k1P, void 0, void 0, { sqrt: sqrtMod });
  const secp256k1 = createCurve({
    a: BigInt(0),
    b: BigInt(7),
    Fp,
    n: secp256k1N,
    // Base point (x, y) aka generator point
    Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
    Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
    h: BigInt(1),
    lowS: true,
    /**
     * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
     * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
     * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
     * Explanation: https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066
     */
    endo: {
      beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
      splitScalar: (k) => {
        const n = secp256k1N;
        const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
        const b1 = -_1n * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
        const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
        const b2 = a1;
        const POW_2_128 = BigInt("0x100000000000000000000000000000000");
        const c1 = divNearest(b2 * k, n);
        const c2 = divNearest(-b1 * k, n);
        let k1 = mod(k - c1 * a1 - c2 * a2, n);
        let k2 = mod(-c1 * b1 - c2 * b2, n);
        const k1neg = k1 > POW_2_128;
        const k2neg = k2 > POW_2_128;
        if (k1neg)
          k1 = n - k1;
        if (k2neg)
          k2 = n - k2;
        if (k1 > POW_2_128 || k2 > POW_2_128) {
          throw new Error("splitScalar: Endomorphism failed, k=" + k);
        }
        return { k1neg, k1, k2neg, k2 };
      }
    }
  }, sha256$1);
  const _0n = BigInt(0);
  const fe = (x) => typeof x === "bigint" && _0n < x && x < secp256k1P;
  const ge = (x) => typeof x === "bigint" && _0n < x && x < secp256k1N;
  const TAGGED_HASH_PREFIXES = {};
  function taggedHash(tag, ...messages) {
    let tagP = TAGGED_HASH_PREFIXES[tag];
    if (tagP === void 0) {
      const tagH = sha256$1(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
      tagP = concatBytes(tagH, tagH);
      TAGGED_HASH_PREFIXES[tag] = tagP;
    }
    return sha256$1(concatBytes(tagP, ...messages));
  }
  const pointToBytes = (point) => point.toRawBytes(true).slice(1);
  const numTo32b = (n) => numberToBytesBE(n, 32);
  const modP = (x) => mod(x, secp256k1P);
  const modN = (x) => mod(x, secp256k1N);
  const Point = secp256k1.ProjectivePoint;
  const GmulAdd = (Q, a, b) => Point.BASE.multiplyAndAddUnsafe(Q, a, b);
  function schnorrGetExtPubKey(priv) {
    let d_ = secp256k1.utils.normPrivateKeyToScalar(priv);
    let p = Point.fromPrivateKey(d_);
    const scalar = p.hasEvenY() ? d_ : modN(-d_);
    return { scalar, bytes: pointToBytes(p) };
  }
  function lift_x(x) {
    if (!fe(x))
      throw new Error("bad x: need 0 < x < p");
    const xx = modP(x * x);
    const c = modP(xx * x + BigInt(7));
    let y = sqrtMod(c);
    if (y % _2n !== _0n)
      y = modP(-y);
    const p = new Point(x, y, _1n);
    p.assertValidity();
    return p;
  }
  function challenge(...args) {
    return modN(bytesToNumberBE(taggedHash("BIP0340/challenge", ...args)));
  }
  function schnorrGetPublicKey(privateKey) {
    return schnorrGetExtPubKey(privateKey).bytes;
  }
  function schnorrSign(message, privateKey, auxRand = randomBytes(32)) {
    const m = ensureBytes("message", message);
    const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey);
    const a = ensureBytes("auxRand", auxRand, 32);
    const t = numTo32b(d ^ bytesToNumberBE(taggedHash("BIP0340/aux", a)));
    const rand = taggedHash("BIP0340/nonce", t, px, m);
    const k_ = modN(bytesToNumberBE(rand));
    if (k_ === _0n)
      throw new Error("sign failed: k is zero");
    const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_);
    const e = challenge(rx, px, m);
    const sig = new Uint8Array(64);
    sig.set(rx, 0);
    sig.set(numTo32b(modN(k + e * d)), 32);
    if (!schnorrVerify(sig, m, px))
      throw new Error("sign: Invalid signature produced");
    return sig;
  }
  function schnorrVerify(signature, message, publicKey) {
    const sig = ensureBytes("signature", signature, 64);
    const m = ensureBytes("message", message);
    const pub = ensureBytes("publicKey", publicKey, 32);
    try {
      const P = lift_x(bytesToNumberBE(pub));
      const r = bytesToNumberBE(sig.subarray(0, 32));
      if (!fe(r))
        return false;
      const s = bytesToNumberBE(sig.subarray(32, 64));
      if (!ge(s))
        return false;
      const e = challenge(numTo32b(r), pointToBytes(P), m);
      const R = GmulAdd(P, s, modN(-e));
      if (!R || !R.hasEvenY() || R.toAffine().x !== r)
        return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  const schnorr = /* @__PURE__ */ (() => ({
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    utils: {
      randomPrivateKey: secp256k1.utils.randomPrivateKey,
      lift_x,
      pointToBytes,
      numberToBytesBE,
      bytesToNumberBE,
      taggedHash,
      mod
    }
  }))();
  /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  const u8a = (a) => a instanceof Uint8Array;
  const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  const rotr = (word, shift) => word << 32 - shift | word >>> shift;
  const isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
  if (!isLE)
    throw new Error("Non little-endian hardware is not supported");
  const hexes = Array.from({ length: 256 }, (v, i2) => i2.toString(16).padStart(2, "0"));
  function bytesToHex(bytes2) {
    if (!u8a(bytes2))
      throw new Error("Uint8Array expected");
    let hex2 = "";
    for (let i2 = 0; i2 < bytes2.length; i2++) {
      hex2 += hexes[bytes2[i2]];
    }
    return hex2;
  }
  function hexToBytes(hex2) {
    if (typeof hex2 !== "string")
      throw new Error("hex string expected, got " + typeof hex2);
    const len = hex2.length;
    if (len % 2)
      throw new Error("padded hex string expected, got unpadded hex of length " + len);
    const array = new Uint8Array(len / 2);
    for (let i2 = 0; i2 < array.length; i2++) {
      const j = i2 * 2;
      const hexByte = hex2.slice(j, j + 2);
      const byte = Number.parseInt(hexByte, 16);
      if (Number.isNaN(byte) || byte < 0)
        throw new Error("Invalid byte sequence");
      array[i2] = byte;
    }
    return array;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function toBytes(data) {
    if (typeof data === "string")
      data = utf8ToBytes(data);
    if (!u8a(data))
      throw new Error(`expected Uint8Array, got ${typeof data}`);
    return data;
  }
  class Hash {
    // Safe version that clones internal state
    clone() {
      return this._cloneInto();
    }
  }
  function wrapConstructor(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
  }
  function number(n) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error(`Wrong positive integer: ${n}`);
  }
  function bool(b) {
    if (typeof b !== "boolean")
      throw new Error(`Expected boolean, not ${b}`);
  }
  function bytes(b, ...lengths) {
    if (!(b instanceof Uint8Array))
      throw new Error("Expected Uint8Array");
    if (lengths.length > 0 && !lengths.includes(b.length))
      throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
  }
  function hash(hash2) {
    if (typeof hash2 !== "function" || typeof hash2.create !== "function")
      throw new Error("Hash should be wrapped by utils.wrapConstructor");
    number(hash2.outputLen);
    number(hash2.blockLen);
  }
  function exists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function output(out, instance) {
    bytes(out);
    const min = instance.outputLen;
    if (out.length < min) {
      throw new Error(`digestInto() expects output buffer of length at least ${min}`);
    }
  }
  const assert = {
    number,
    bool,
    bytes,
    hash,
    exists,
    output
  };
  function setBigUint64(view, byteOffset, value, isLE2) {
    if (typeof view.setBigUint64 === "function")
      return view.setBigUint64(byteOffset, value, isLE2);
    const _32n = BigInt(32);
    const _u32_max = BigInt(4294967295);
    const wh = Number(value >> _32n & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE2 ? 4 : 0;
    const l = isLE2 ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE2);
    view.setUint32(byteOffset + l, wl, isLE2);
  }
  class SHA2 extends Hash {
    constructor(blockLen, outputLen, padOffset, isLE2) {
      super();
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.finished = false;
      this.length = 0;
      this.pos = 0;
      this.destroyed = false;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      assert.exists(this);
      const { view, buffer, blockLen } = this;
      data = toBytes(data);
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
        }
      }
      this.length += data.length;
      this.roundClean();
      return this;
    }
    digestInto(out) {
      assert.exists(this);
      assert.output(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      this.buffer.subarray(pos).fill(0);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        pos = 0;
      }
      for (let i2 = pos; i2 < blockLen; i2++)
        buffer[i2] = 0;
      setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
      this.process(view, 0);
      const oview = createView(out);
      const len = this.outputLen;
      if (len % 4)
        throw new Error("_sha2: outputLen should be aligned to 32bit");
      const outLen = len / 4;
      const state = this.get();
      if (outLen > state.length)
        throw new Error("_sha2: outputLen bigger than state");
      for (let i2 = 0; i2 < outLen; i2++)
        oview.setUint32(4 * i2, state[i2], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      to || (to = new this.constructor());
      to.set(...this.get());
      const { blockLen, buffer, length, finished, destroyed, pos } = this;
      to.length = length;
      to.pos = pos;
      to.finished = finished;
      to.destroyed = destroyed;
      if (length % blockLen)
        to.buffer.set(buffer);
      return to;
    }
  }
  const Chi = (a, b, c) => a & b ^ ~a & c;
  const Maj = (a, b, c) => a & b ^ a & c ^ b & c;
  const SHA256_K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  const IV = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const SHA256_W = new Uint32Array(64);
  class SHA256 extends SHA2 {
    constructor() {
      super(64, 32, 8, false);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    process(view, offset) {
      for (let i2 = 0; i2 < 16; i2++, offset += 4)
        SHA256_W[i2] = view.getUint32(offset, false);
      for (let i2 = 16; i2 < 64; i2++) {
        const W15 = SHA256_W[i2 - 15];
        const W2 = SHA256_W[i2 - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i2] = s1 + SHA256_W[i2 - 7] + s0 + SHA256_W[i2 - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i2 = 0; i2 < 64; i2++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i2] + SHA256_W[i2] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      SHA256_W.fill(0);
    }
    destroy() {
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      this.buffer.fill(0);
    }
  }
  class SHA224 extends SHA256 {
    constructor() {
      super();
      this.A = 3238371032 | 0;
      this.B = 914150663 | 0;
      this.C = 812702999 | 0;
      this.D = 4144912697 | 0;
      this.E = 4290775857 | 0;
      this.F = 1750603025 | 0;
      this.G = 1694076839 | 0;
      this.H = 3204075428 | 0;
      this.outputLen = 28;
    }
  }
  const sha256 = wrapConstructor(() => new SHA256());
  wrapConstructor(() => new SHA224());
  var verifiedSymbol$3 = Symbol("verified");
  var isRecord$3 = (obj) => obj instanceof Object;
  function validateEvent$3(event) {
    if (!isRecord$3(event))
      return false;
    if (typeof event.kind !== "number")
      return false;
    if (typeof event.content !== "string")
      return false;
    if (typeof event.created_at !== "number")
      return false;
    if (typeof event.pubkey !== "string")
      return false;
    if (!event.pubkey.match(/^[a-f0-9]{64}$/))
      return false;
    if (!Array.isArray(event.tags))
      return false;
    for (let i2 = 0; i2 < event.tags.length; i2++) {
      let tag = event.tags[i2];
      if (!Array.isArray(tag))
        return false;
      for (let j = 0; j < tag.length; j++) {
        if (typeof tag[j] === "object")
          return false;
      }
    }
    return true;
  }
  new TextDecoder("utf-8");
  var utf8Encoder$3 = new TextEncoder();
  function normalizeURL$3(url) {
    if (url.indexOf("://") === -1)
      url = "wss://" + url;
    let p = new URL(url);
    p.pathname = p.pathname.replace(/\/+/g, "/");
    if (p.pathname.endsWith("/"))
      p.pathname = p.pathname.slice(0, -1);
    if (p.port === "80" && p.protocol === "ws:" || p.port === "443" && p.protocol === "wss:")
      p.port = "";
    p.searchParams.sort();
    p.hash = "";
    return p.toString();
  }
  var QueueNode$1 = class QueueNode {
    constructor(message) {
      __publicField(this, "value");
      __publicField(this, "next", null);
      __publicField(this, "prev", null);
      this.value = message;
    }
  };
  var Queue$1 = class Queue {
    constructor() {
      __publicField(this, "first");
      __publicField(this, "last");
      this.first = null;
      this.last = null;
    }
    enqueue(value) {
      const newNode = new QueueNode$1(value);
      if (!this.last) {
        this.first = newNode;
        this.last = newNode;
      } else if (this.last === this.first) {
        this.last = newNode;
        this.last.prev = this.first;
        this.first.next = newNode;
      } else {
        newNode.prev = this.last;
        this.last.next = newNode;
        this.last = newNode;
      }
      return true;
    }
    dequeue() {
      if (!this.first)
        return null;
      if (this.first === this.last) {
        const target2 = this.first;
        this.first = null;
        this.last = null;
        return target2.value;
      }
      const target = this.first;
      this.first = target.next;
      return target.value;
    }
  };
  var JS$3 = class JS {
    generateSecretKey() {
      return schnorr.utils.randomPrivateKey();
    }
    getPublicKey(secretKey) {
      return bytesToHex(schnorr.getPublicKey(secretKey));
    }
    finalizeEvent(t, secretKey) {
      const event = t;
      event.pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      event.id = getEventHash$3(event);
      event.sig = bytesToHex(schnorr.sign(getEventHash$3(event), secretKey));
      event[verifiedSymbol$3] = true;
      return event;
    }
    verifyEvent(event) {
      if (typeof event[verifiedSymbol$3] === "boolean")
        return event[verifiedSymbol$3];
      const hash2 = getEventHash$3(event);
      if (hash2 !== event.id) {
        event[verifiedSymbol$3] = false;
        return false;
      }
      try {
        const valid = schnorr.verify(event.sig, hash2, event.pubkey);
        event[verifiedSymbol$3] = valid;
        return valid;
      } catch (err) {
        event[verifiedSymbol$3] = false;
        return false;
      }
    }
  };
  function serializeEvent$3(evt) {
    if (!validateEvent$3(evt))
      throw new Error("can't serialize event with wrong or missing properties");
    return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
  }
  function getEventHash$3(event) {
    let eventHash = sha256(utf8Encoder$3.encode(serializeEvent$3(event)));
    return bytesToHex(eventHash);
  }
  var i$3 = new JS$3();
  i$3.generateSecretKey;
  i$3.getPublicKey;
  i$3.finalizeEvent;
  var verifyEvent$1 = i$3.verifyEvent;
  var ClientAuth$1 = 22242;
  function matchFilter$1(filter, event) {
    if (filter.ids && filter.ids.indexOf(event.id) === -1) {
      return false;
    }
    if (filter.kinds && filter.kinds.indexOf(event.kind) === -1) {
      return false;
    }
    if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
      return false;
    }
    for (let f in filter) {
      if (f[0] === "#") {
        let tagName = f.slice(1);
        let values = filter[`#${tagName}`];
        if (values && !event.tags.find(([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1))
          return false;
      }
    }
    if (filter.since && event.created_at < filter.since)
      return false;
    if (filter.until && event.created_at > filter.until)
      return false;
    return true;
  }
  function matchFilters$1(filters, event) {
    for (let i2 = 0; i2 < filters.length; i2++) {
      if (matchFilter$1(filters[i2], event)) {
        return true;
      }
    }
    return false;
  }
  function getHex64$1(json, field) {
    let len = field.length + 3;
    let idx = json.indexOf(`"${field}":`) + len;
    let s = json.slice(idx).indexOf(`"`) + idx + 1;
    return json.slice(s, s + 64);
  }
  function getSubscriptionId$1(json) {
    let idx = json.slice(0, 22).indexOf(`"EVENT"`);
    if (idx === -1)
      return null;
    let pstart = json.slice(idx + 7 + 1).indexOf(`"`);
    if (pstart === -1)
      return null;
    let start = idx + 7 + 1 + pstart;
    let pend = json.slice(start + 1, 80).indexOf(`"`);
    if (pend === -1)
      return null;
    let end = start + 1 + pend;
    return json.slice(start + 1, end);
  }
  function makeAuthEvent$1(relayURL, challenge2) {
    return {
      kind: ClientAuth$1,
      created_at: Math.floor(Date.now() / 1e3),
      tags: [
        ["relay", relayURL],
        ["challenge", challenge2]
      ],
      content: ""
    };
  }
  async function yieldThread$1() {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      const handler = () => {
        ch.port1.removeEventListener("message", handler);
        resolve();
      };
      ch.port1.addEventListener("message", handler);
      ch.port2.postMessage(0);
      ch.port1.start();
    });
  }
  var alwaysTrue = (t) => {
    t[verifiedSymbol$3] = true;
    return true;
  };
  var AbstractRelay$1 = class AbstractRelay {
    constructor(url, opts) {
      __publicField(this, "url");
      __publicField(this, "_connected", false);
      __publicField(this, "onclose", null);
      __publicField(this, "onnotice", (msg) => console.debug(`NOTICE from ${this.url}: ${msg}`));
      __publicField(this, "_onauth", null);
      __publicField(this, "baseEoseTimeout", 4400);
      __publicField(this, "connectionTimeout", 4400);
      __publicField(this, "openSubs", /* @__PURE__ */ new Map());
      __publicField(this, "connectionTimeoutHandle");
      __publicField(this, "connectionPromise");
      __publicField(this, "openCountRequests", /* @__PURE__ */ new Map());
      __publicField(this, "openEventPublishes", /* @__PURE__ */ new Map());
      __publicField(this, "ws");
      __publicField(this, "incomingMessageQueue", new Queue$1());
      __publicField(this, "queueRunning", false);
      __publicField(this, "challenge");
      __publicField(this, "serial", 0);
      __publicField(this, "verifyEvent");
      __publicField(this, "_WebSocket");
      this.url = normalizeURL$3(url);
      this.verifyEvent = opts.verifyEvent;
      this._WebSocket = opts.websocketImplementation || WebSocket;
    }
    static async connect(url, opts) {
      const relay = new AbstractRelay$1(url, opts);
      await relay.connect();
      return relay;
    }
    closeAllSubscriptions(reason) {
      for (let [_, sub] of this.openSubs) {
        sub.close(reason);
      }
      this.openSubs.clear();
      for (let [_, ep] of this.openEventPublishes) {
        ep.reject(new Error(reason));
      }
      this.openEventPublishes.clear();
      for (let [_, cr] of this.openCountRequests) {
        cr.reject(new Error(reason));
      }
      this.openCountRequests.clear();
    }
    get connected() {
      return this._connected;
    }
    async connect() {
      if (this.connectionPromise)
        return this.connectionPromise;
      this.challenge = void 0;
      this.connectionPromise = new Promise((resolve, reject) => {
        this.connectionTimeoutHandle = setTimeout(() => {
          var _a2;
          reject("connection timed out");
          this.connectionPromise = void 0;
          (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
          this.closeAllSubscriptions("relay connection timed out");
        }, this.connectionTimeout);
        try {
          this.ws = new this._WebSocket(this.url);
        } catch (err) {
          reject(err);
          return;
        }
        this.ws.onopen = () => {
          clearTimeout(this.connectionTimeoutHandle);
          this._connected = true;
          resolve();
        };
        this.ws.onerror = (ev) => {
          var _a2;
          reject(ev.message);
          if (this._connected) {
            this._connected = false;
            this.connectionPromise = void 0;
            (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
            this.closeAllSubscriptions("relay connection errored");
          }
        };
        this.ws.onclose = async () => {
          var _a2;
          if (this._connected) {
            this._connected = false;
            this.connectionPromise = void 0;
            (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
            this.closeAllSubscriptions("relay connection closed");
          }
        };
        this.ws.onmessage = this._onmessage.bind(this);
      });
      return this.connectionPromise;
    }
    async runQueue() {
      this.queueRunning = true;
      while (true) {
        if (false === this.handleNext()) {
          break;
        }
        await yieldThread$1();
      }
      this.queueRunning = false;
    }
    handleNext() {
      var _a2, _b2, _c;
      const json = this.incomingMessageQueue.dequeue();
      if (!json) {
        return false;
      }
      const subid = getSubscriptionId$1(json);
      if (subid) {
        const so = this.openSubs.get(subid);
        if (!so) {
          return;
        }
        const id = getHex64$1(json, "id");
        const alreadyHave = (_a2 = so.alreadyHaveEvent) == null ? void 0 : _a2.call(so, id);
        (_b2 = so.receivedEvent) == null ? void 0 : _b2.call(so, this, id);
        if (alreadyHave) {
          return;
        }
      }
      try {
        let data = JSON.parse(json);
        switch (data[0]) {
          case "EVENT": {
            const so = this.openSubs.get(data[1]);
            const event = data[2];
            if (this.verifyEvent(event) && matchFilters$1(so.filters, event)) {
              so.onevent(event);
            }
            return;
          }
          case "COUNT": {
            const id = data[1];
            const payload = data[2];
            const cr = this.openCountRequests.get(id);
            if (cr) {
              cr.resolve(payload.count);
              this.openCountRequests.delete(id);
            }
            return;
          }
          case "EOSE": {
            const so = this.openSubs.get(data[1]);
            if (!so)
              return;
            so.receivedEose();
            return;
          }
          case "OK": {
            const id = data[1];
            const ok = data[2];
            const reason = data[3];
            const ep = this.openEventPublishes.get(id);
            if (ok)
              ep.resolve(reason);
            else
              ep.reject(new Error(reason));
            this.openEventPublishes.delete(id);
            return;
          }
          case "CLOSED": {
            const id = data[1];
            const so = this.openSubs.get(id);
            if (!so)
              return;
            so.closed = true;
            so.close(data[2]);
            return;
          }
          case "NOTICE":
            this.onnotice(data[1]);
            return;
          case "AUTH": {
            this.challenge = data[1];
            (_c = this._onauth) == null ? void 0 : _c.call(this, data[1]);
            return;
          }
        }
      } catch (err) {
        return;
      }
    }
    async send(message) {
      if (!this.connectionPromise)
        throw new Error("sending on closed connection");
      this.connectionPromise.then(() => {
        var _a2;
        (_a2 = this.ws) == null ? void 0 : _a2.send(message);
      });
    }
    async auth(signAuthEvent) {
      if (!this.challenge)
        throw new Error("can't perform auth, no challenge was received");
      const evt = await signAuthEvent(makeAuthEvent$1(this.url, this.challenge));
      const ret = new Promise((resolve, reject) => {
        this.openEventPublishes.set(evt.id, { resolve, reject });
      });
      this.send('["AUTH",' + JSON.stringify(evt) + "]");
      return ret;
    }
    async publish(event) {
      const ret = new Promise((resolve, reject) => {
        this.openEventPublishes.set(event.id, { resolve, reject });
      });
      this.send('["EVENT",' + JSON.stringify(event) + "]");
      return ret;
    }
    async count(filters, params) {
      this.serial++;
      const id = (params == null ? void 0 : params.id) || "count:" + this.serial;
      const ret = new Promise((resolve, reject) => {
        this.openCountRequests.set(id, { resolve, reject });
      });
      this.send('["COUNT","' + id + '",' + JSON.stringify(filters).substring(1));
      return ret;
    }
    subscribe(filters, params) {
      const subscription = this.prepareSubscription(filters, params);
      subscription.fire();
      return subscription;
    }
    prepareSubscription(filters, params) {
      this.serial++;
      const id = params.id || "sub:" + this.serial;
      const subscription = new Subscription$1(this, id, filters, params);
      this.openSubs.set(id, subscription);
      return subscription;
    }
    close() {
      var _a2;
      this.closeAllSubscriptions("relay connection closed by us");
      this._connected = false;
      (_a2 = this.ws) == null ? void 0 : _a2.close();
    }
    _onmessage(ev) {
      this.incomingMessageQueue.enqueue(ev.data);
      if (!this.queueRunning) {
        this.runQueue();
      }
    }
  };
  var Subscription$1 = class Subscription {
    constructor(relay, id, filters, params) {
      __publicField(this, "relay");
      __publicField(this, "id");
      __publicField(this, "closed", false);
      __publicField(this, "eosed", false);
      __publicField(this, "filters");
      __publicField(this, "alreadyHaveEvent");
      __publicField(this, "receivedEvent");
      __publicField(this, "onevent");
      __publicField(this, "oneose");
      __publicField(this, "onclose");
      __publicField(this, "eoseTimeout");
      __publicField(this, "eoseTimeoutHandle");
      this.relay = relay;
      this.filters = filters;
      this.id = id;
      this.alreadyHaveEvent = params.alreadyHaveEvent;
      this.receivedEvent = params.receivedEvent;
      this.eoseTimeout = params.eoseTimeout || relay.baseEoseTimeout;
      this.oneose = params.oneose;
      this.onclose = params.onclose;
      this.onevent = params.onevent || ((event) => {
        console.warn(
          `onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
          event
        );
      });
    }
    fire() {
      this.relay.send('["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1));
      this.eoseTimeoutHandle = setTimeout(this.receivedEose.bind(this), this.eoseTimeout);
    }
    receivedEose() {
      var _a2;
      if (this.eosed)
        return;
      clearTimeout(this.eoseTimeoutHandle);
      this.eosed = true;
      (_a2 = this.oneose) == null ? void 0 : _a2.call(this);
    }
    close(reason = "closed by caller") {
      var _a2;
      if (!this.closed && this.relay.connected) {
        this.relay.send('["CLOSE",' + JSON.stringify(this.id) + "]");
        this.closed = true;
      }
      this.relay.openSubs.delete(this.id);
      (_a2 = this.onclose) == null ? void 0 : _a2.call(this, reason);
    }
  };
  var AbstractSimplePool = class {
    constructor(opts) {
      __publicField(this, "relays", /* @__PURE__ */ new Map());
      __publicField(this, "seenOn", /* @__PURE__ */ new Map());
      __publicField(this, "trackRelays", false);
      __publicField(this, "verifyEvent");
      __publicField(this, "trustedRelayURLs", /* @__PURE__ */ new Set());
      __publicField(this, "_WebSocket");
      this.verifyEvent = opts.verifyEvent;
      this._WebSocket = opts.websocketImplementation;
    }
    async ensureRelay(url, params) {
      url = normalizeURL$3(url);
      let relay = this.relays.get(url);
      if (!relay) {
        relay = new AbstractRelay$1(url, {
          verifyEvent: this.trustedRelayURLs.has(url) ? alwaysTrue : this.verifyEvent,
          websocketImplementation: this._WebSocket
        });
        if (params == null ? void 0 : params.connectionTimeout)
          relay.connectionTimeout = params.connectionTimeout;
        this.relays.set(url, relay);
      }
      await relay.connect();
      return relay;
    }
    close(relays) {
      relays.map(normalizeURL$3).forEach((url) => {
        var _a2;
        (_a2 = this.relays.get(url)) == null ? void 0 : _a2.close();
      });
    }
    subscribeMany(relays, filters, params) {
      return this.subscribeManyMap(Object.fromEntries(relays.map((url) => [url, filters])), params);
    }
    subscribeManyMap(requests, params) {
      if (this.trackRelays) {
        params.receivedEvent = (relay, id) => {
          let set = this.seenOn.get(id);
          if (!set) {
            set = /* @__PURE__ */ new Set();
            this.seenOn.set(id, set);
          }
          set.add(relay);
        };
      }
      const _knownIds = /* @__PURE__ */ new Set();
      const subs = [];
      const relaysLength = Object.keys(requests).length;
      const eosesReceived = [];
      let handleEose = (i2) => {
        var _a2;
        eosesReceived[i2] = true;
        if (eosesReceived.filter((a) => a).length === relaysLength) {
          (_a2 = params.oneose) == null ? void 0 : _a2.call(params);
          handleEose = () => {
          };
        }
      };
      const closesReceived = [];
      let handleClose = (i2, reason) => {
        var _a2;
        handleEose(i2);
        closesReceived[i2] = reason;
        if (closesReceived.filter((a) => a).length === relaysLength) {
          (_a2 = params.onclose) == null ? void 0 : _a2.call(params, closesReceived);
          handleClose = () => {
          };
        }
      };
      const localAlreadyHaveEventHandler = (id) => {
        var _a2;
        if ((_a2 = params.alreadyHaveEvent) == null ? void 0 : _a2.call(params, id)) {
          return true;
        }
        const have = _knownIds.has(id);
        _knownIds.add(id);
        return have;
      };
      const allOpened = Promise.all(
        Object.entries(requests).map(async (req, i2, arr) => {
          if (arr.indexOf(req) !== i2) {
            handleClose(i2, "duplicate url");
            return;
          }
          let [url, filters] = req;
          url = normalizeURL$3(url);
          let relay;
          try {
            relay = await this.ensureRelay(url, {
              connectionTimeout: params.maxWait ? Math.max(params.maxWait * 0.8, params.maxWait - 1e3) : void 0
            });
          } catch (err) {
            handleClose(i2, (err == null ? void 0 : err.message) || String(err));
            return;
          }
          let subscription = relay.subscribe(filters, {
            ...params,
            oneose: () => handleEose(i2),
            onclose: (reason) => handleClose(i2, reason),
            alreadyHaveEvent: localAlreadyHaveEventHandler,
            eoseTimeout: params.maxWait
          });
          subs.push(subscription);
        })
      );
      return {
        async close() {
          await allOpened;
          subs.forEach((sub) => {
            sub.close();
          });
        }
      };
    }
    subscribeManyEose(relays, filters, params) {
      const subcloser = this.subscribeMany(relays, filters, {
        ...params,
        oneose() {
          subcloser.close();
        }
      });
      return subcloser;
    }
    async querySync(relays, filter, params) {
      return new Promise(async (resolve) => {
        const events = [];
        this.subscribeManyEose(relays, [filter], {
          ...params,
          onevent(event) {
            events.push(event);
          },
          onclose(_) {
            resolve(events);
          }
        });
      });
    }
    async get(relays, filter, params) {
      filter.limit = 1;
      const events = await this.querySync(relays, filter, params);
      events.sort((a, b) => b.created_at - a.created_at);
      return events[0] || null;
    }
    publish(relays, event) {
      return relays.map(normalizeURL$3).map(async (url, i2, arr) => {
        if (arr.indexOf(url) !== i2) {
          return Promise.reject("duplicate url");
        }
        let r = await this.ensureRelay(url);
        return r.publish(event);
      });
    }
  };
  var _WebSocket$1;
  try {
    _WebSocket$1 = WebSocket;
  } catch {
  }
  var SimplePool = class extends AbstractSimplePool {
    constructor() {
      super({ verifyEvent: verifyEvent$1, websocketImplementation: _WebSocket$1 });
    }
  };
  const $RAW = Symbol("store-raw"), $NODE = Symbol("store-node"), $HAS = Symbol("store-has"), $SELF = Symbol("store-self");
  function wrap$1(value) {
    let p = value[$PROXY];
    if (!p) {
      Object.defineProperty(value, $PROXY, {
        value: p = new Proxy(value, proxyTraps$1)
      });
      if (!Array.isArray(value)) {
        const keys = Object.keys(value), desc = Object.getOwnPropertyDescriptors(value);
        for (let i2 = 0, l = keys.length; i2 < l; i2++) {
          const prop = keys[i2];
          if (desc[prop].get) {
            Object.defineProperty(value, prop, {
              enumerable: desc[prop].enumerable,
              get: desc[prop].get.bind(p)
            });
          }
        }
      }
    }
    return p;
  }
  function isWrappable(obj) {
    let proto;
    return obj != null && typeof obj === "object" && (obj[$PROXY] || !(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj));
  }
  function unwrap$1(item, set = /* @__PURE__ */ new Set()) {
    let result, unwrapped, v, prop;
    if (result = item != null && item[$RAW])
      return result;
    if (!isWrappable(item) || set.has(item))
      return item;
    if (Array.isArray(item)) {
      if (Object.isFrozen(item))
        item = item.slice(0);
      else
        set.add(item);
      for (let i2 = 0, l = item.length; i2 < l; i2++) {
        v = item[i2];
        if ((unwrapped = unwrap$1(v, set)) !== v)
          item[i2] = unwrapped;
      }
    } else {
      if (Object.isFrozen(item))
        item = Object.assign({}, item);
      else
        set.add(item);
      const keys = Object.keys(item), desc = Object.getOwnPropertyDescriptors(item);
      for (let i2 = 0, l = keys.length; i2 < l; i2++) {
        prop = keys[i2];
        if (desc[prop].get)
          continue;
        v = item[prop];
        if ((unwrapped = unwrap$1(v, set)) !== v)
          item[prop] = unwrapped;
      }
    }
    return item;
  }
  function getNodes(target, symbol) {
    let nodes = target[symbol];
    if (!nodes)
      Object.defineProperty(target, symbol, {
        value: nodes = /* @__PURE__ */ Object.create(null)
      });
    return nodes;
  }
  function getNode(nodes, property, value) {
    if (nodes[property])
      return nodes[property];
    const [s, set] = createSignal(value, {
      equals: false,
      internal: true
    });
    s.$ = set;
    return nodes[property] = s;
  }
  function proxyDescriptor$1(target, property) {
    const desc = Reflect.getOwnPropertyDescriptor(target, property);
    if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE)
      return desc;
    delete desc.value;
    delete desc.writable;
    desc.get = () => target[$PROXY][property];
    return desc;
  }
  function trackSelf(target) {
    getListener() && getNode(getNodes(target, $NODE), $SELF)();
  }
  function ownKeys(target) {
    trackSelf(target);
    return Reflect.ownKeys(target);
  }
  const proxyTraps$1 = {
    get(target, property, receiver) {
      if (property === $RAW)
        return target;
      if (property === $PROXY)
        return receiver;
      if (property === $TRACK) {
        trackSelf(target);
        return receiver;
      }
      const nodes = getNodes(target, $NODE);
      const tracked = nodes[property];
      let value = tracked ? tracked() : target[property];
      if (property === $NODE || property === $HAS || property === "__proto__")
        return value;
      if (!tracked) {
        const desc = Object.getOwnPropertyDescriptor(target, property);
        if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property)) && !(desc && desc.get))
          value = getNode(nodes, property, value)();
      }
      return isWrappable(value) ? wrap$1(value) : value;
    },
    has(target, property) {
      if (property === $RAW || property === $PROXY || property === $TRACK || property === $NODE || property === $HAS || property === "__proto__")
        return true;
      getListener() && getNode(getNodes(target, $HAS), property)();
      return property in target;
    },
    set() {
      return true;
    },
    deleteProperty() {
      return true;
    },
    ownKeys,
    getOwnPropertyDescriptor: proxyDescriptor$1
  };
  function setProperty(state, property, value, deleting = false) {
    if (!deleting && state[property] === value)
      return;
    const prev = state[property], len = state.length;
    if (value === void 0) {
      delete state[property];
      if (state[$HAS] && state[$HAS][property] && prev !== void 0)
        state[$HAS][property].$();
    } else {
      state[property] = value;
      if (state[$HAS] && state[$HAS][property] && prev === void 0)
        state[$HAS][property].$();
    }
    let nodes = getNodes(state, $NODE), node;
    if (node = getNode(nodes, property, prev))
      node.$(() => value);
    if (Array.isArray(state) && state.length !== len) {
      for (let i2 = state.length; i2 < len; i2++)
        (node = nodes[i2]) && node.$();
      (node = getNode(nodes, "length", len)) && node.$(state.length);
    }
    (node = nodes[$SELF]) && node.$();
  }
  function mergeStoreNode(state, value) {
    const keys = Object.keys(value);
    for (let i2 = 0; i2 < keys.length; i2 += 1) {
      const key = keys[i2];
      setProperty(state, key, value[key]);
    }
  }
  function updateArray(current, next) {
    if (typeof next === "function")
      next = next(current);
    next = unwrap$1(next);
    if (Array.isArray(next)) {
      if (current === next)
        return;
      let i2 = 0, len = next.length;
      for (; i2 < len; i2++) {
        const value = next[i2];
        if (current[i2] !== value)
          setProperty(current, i2, value);
      }
      setProperty(current, "length", len);
    } else
      mergeStoreNode(current, next);
  }
  function updatePath(current, path, traversed = []) {
    let part, prev = current;
    if (path.length > 1) {
      part = path.shift();
      const partType = typeof part, isArray = Array.isArray(current);
      if (Array.isArray(part)) {
        for (let i2 = 0; i2 < part.length; i2++) {
          updatePath(current, [part[i2]].concat(path), traversed);
        }
        return;
      } else if (isArray && partType === "function") {
        for (let i2 = 0; i2 < current.length; i2++) {
          if (part(current[i2], i2))
            updatePath(current, [i2].concat(path), traversed);
        }
        return;
      } else if (isArray && partType === "object") {
        const { from = 0, to = current.length - 1, by = 1 } = part;
        for (let i2 = from; i2 <= to; i2 += by) {
          updatePath(current, [i2].concat(path), traversed);
        }
        return;
      } else if (path.length > 1) {
        updatePath(current[part], path, [part].concat(traversed));
        return;
      }
      prev = current[part];
      traversed = [part].concat(traversed);
    }
    let value = path[0];
    if (typeof value === "function") {
      value = value(prev, traversed);
      if (value === prev)
        return;
    }
    if (part === void 0 && value == void 0)
      return;
    value = unwrap$1(value);
    if (part === void 0 || isWrappable(prev) && isWrappable(value) && !Array.isArray(value)) {
      mergeStoreNode(prev, value);
    } else
      setProperty(current, part, value);
  }
  function createStore(...[store2, options]) {
    const unwrappedStore = unwrap$1(store2 || {});
    const isArray = Array.isArray(unwrappedStore);
    const wrappedStore = wrap$1(unwrappedStore);
    function setStore(...args) {
      batch(() => {
        isArray && args.length === 1 ? updateArray(unwrappedStore, args[0]) : updatePath(unwrappedStore, args);
      });
    }
    return [wrappedStore, setStore];
  }
  function proxyDescriptor(target, property) {
    const desc = Reflect.getOwnPropertyDescriptor(target, property);
    if (!desc || desc.get || desc.set || !desc.configurable || property === $PROXY || property === $NODE)
      return desc;
    delete desc.value;
    delete desc.writable;
    desc.get = () => target[$PROXY][property];
    desc.set = (v) => target[$PROXY][property] = v;
    return desc;
  }
  const proxyTraps = {
    get(target, property, receiver) {
      if (property === $RAW)
        return target;
      if (property === $PROXY)
        return receiver;
      if (property === $TRACK) {
        trackSelf(target);
        return receiver;
      }
      const nodes = getNodes(target, $NODE);
      const tracked = nodes[property];
      let value = tracked ? tracked() : target[property];
      if (property === $NODE || property === $HAS || property === "__proto__")
        return value;
      if (!tracked) {
        const desc = Object.getOwnPropertyDescriptor(target, property);
        const isFunction2 = typeof value === "function";
        if (getListener() && (!isFunction2 || target.hasOwnProperty(property)) && !(desc && desc.get))
          value = getNode(nodes, property, value)();
        else if (value != null && isFunction2 && value === Array.prototype[property]) {
          return (...args) => batch(() => Array.prototype[property].apply(receiver, args));
        }
      }
      return isWrappable(value) ? wrap$2(value) : value;
    },
    has(target, property) {
      if (property === $RAW || property === $PROXY || property === $TRACK || property === $NODE || property === $HAS || property === "__proto__")
        return true;
      getListener() && getNode(getNodes(target, $HAS), property)();
      return property in target;
    },
    set(target, property, value) {
      batch(() => setProperty(target, property, unwrap$1(value)));
      return true;
    },
    deleteProperty(target, property) {
      batch(() => setProperty(target, property, void 0, true));
      return true;
    },
    ownKeys,
    getOwnPropertyDescriptor: proxyDescriptor
  };
  function wrap$2(value) {
    let p = value[$PROXY];
    if (!p) {
      Object.defineProperty(value, $PROXY, {
        value: p = new Proxy(value, proxyTraps)
      });
      const keys = Object.keys(value), desc = Object.getOwnPropertyDescriptors(value);
      const proto = Object.getPrototypeOf(value);
      const isClass = value !== null && typeof value === "object" && !Array.isArray(value) && proto !== Object.prototype;
      if (isClass) {
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        keys.push(...Object.keys(descriptors));
        Object.assign(desc, descriptors);
      }
      for (let i2 = 0, l = keys.length; i2 < l; i2++) {
        const prop = keys[i2];
        if (isClass && prop === "constructor")
          continue;
        if (desc[prop].get) {
          const get = desc[prop].get.bind(p);
          Object.defineProperty(value, prop, {
            get,
            configurable: true
          });
        }
        if (desc[prop].set) {
          const og = desc[prop].set, set = (v) => batch(() => og.call(p, v));
          Object.defineProperty(value, prop, {
            set,
            configurable: true
          });
        }
      }
    }
    return p;
  }
  function createMutable(state, options) {
    const unwrappedStore = unwrap$1(state || {});
    const wrappedStore = wrap$2(unwrappedStore);
    return wrappedStore;
  }
  const $ROOT = Symbol("store-root");
  function applyState(target, parent, property, merge, key) {
    const previous = parent[property];
    if (target === previous)
      return;
    const isArray = Array.isArray(target);
    if (property !== $ROOT && (!isWrappable(target) || !isWrappable(previous) || isArray !== Array.isArray(previous) || key && target[key] !== previous[key])) {
      setProperty(parent, property, target);
      return;
    }
    if (isArray) {
      if (target.length && previous.length && (!merge || key && target[0] && target[0][key] != null)) {
        let i2, j, start, end, newEnd, item, newIndicesNext, keyVal;
        for (start = 0, end = Math.min(previous.length, target.length); start < end && (previous[start] === target[start] || key && previous[start] && target[start] && previous[start][key] === target[start][key]); start++) {
          applyState(target[start], previous, start, merge, key);
        }
        const temp = new Array(target.length), newIndices = /* @__PURE__ */ new Map();
        for (end = previous.length - 1, newEnd = target.length - 1; end >= start && newEnd >= start && (previous[end] === target[newEnd] || key && previous[start] && target[start] && previous[end][key] === target[newEnd][key]); end--, newEnd--) {
          temp[newEnd] = previous[end];
        }
        if (start > newEnd || start > end) {
          for (j = start; j <= newEnd; j++)
            setProperty(previous, j, target[j]);
          for (; j < target.length; j++) {
            setProperty(previous, j, temp[j]);
            applyState(target[j], previous, j, merge, key);
          }
          if (previous.length > target.length)
            setProperty(previous, "length", target.length);
          return;
        }
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = target[j];
          keyVal = key && item ? item[key] : item;
          i2 = newIndices.get(keyVal);
          newIndicesNext[j] = i2 === void 0 ? -1 : i2;
          newIndices.set(keyVal, j);
        }
        for (i2 = start; i2 <= end; i2++) {
          item = previous[i2];
          keyVal = key && item ? item[key] : item;
          j = newIndices.get(keyVal);
          if (j !== void 0 && j !== -1) {
            temp[j] = previous[i2];
            j = newIndicesNext[j];
            newIndices.set(keyVal, j);
          }
        }
        for (j = start; j < target.length; j++) {
          if (j in temp) {
            setProperty(previous, j, temp[j]);
            applyState(target[j], previous, j, merge, key);
          } else
            setProperty(previous, j, target[j]);
        }
      } else {
        for (let i2 = 0, len = target.length; i2 < len; i2++) {
          applyState(target[i2], previous, i2, merge, key);
        }
      }
      if (previous.length > target.length)
        setProperty(previous, "length", target.length);
      return;
    }
    const targetKeys = Object.keys(target);
    for (let i2 = 0, len = targetKeys.length; i2 < len; i2++) {
      applyState(target[targetKeys[i2]], previous, targetKeys[i2], merge, key);
    }
    const previousKeys = Object.keys(previous);
    for (let i2 = 0, len = previousKeys.length; i2 < len; i2++) {
      if (target[previousKeys[i2]] === void 0)
        setProperty(previous, previousKeys[i2], void 0);
    }
  }
  function reconcile(value, options = {}) {
    const { merge, key = "id" } = options, v = unwrap$1(value);
    return (state) => {
      if (!isWrappable(state) || !isWrappable(v))
        return v;
      const res = applyState(
        v,
        {
          [$ROOT]: state
        },
        $ROOT,
        merge,
        key
      );
      return res === void 0 ? state : res;
    };
  }
  const pool = new SimplePool();
  const store = createMutable({
    readRelays: [],
    writeRelays: [],
    rootEventIds: [],
    topRootEventIds: /* @__PURE__ */ new Set(),
    userObservedComments: false,
    userStartedReadingComments: false,
    threadCollapsed: /* @__PURE__ */ new Map(),
    messageExpanded: new ReactiveSet(),
    languages: [],
    maxCommentLength: 0,
    validatedEvents: /* @__PURE__ */ new Map(),
    validateReadPow: true,
    writePowDifficulty: 0,
    filter: {},
    profiles: () => []
  });
  const signersStore = createMutable({});
  const _types = ["reply", "likes", "votes", "zaps", "publish", "watch", "replyAnonymously", "hideContent"];
  const isDisableType = (type) => {
    return _types.includes(type);
  };
  var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var lib = {};
  (function(exports) {
    /*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bytes = exports.stringToBytes = exports.str = exports.bytesToString = exports.hex = exports.utf8 = exports.bech32m = exports.bech32 = exports.base58check = exports.base58xmr = exports.base58xrp = exports.base58flickr = exports.base58 = exports.base64url = exports.base64 = exports.base32crockford = exports.base32hex = exports.base32 = exports.base16 = exports.utils = exports.assertNumber = void 0;
    function assertNumber(n) {
      if (!Number.isSafeInteger(n))
        throw new Error(`Wrong integer: ${n}`);
    }
    exports.assertNumber = assertNumber;
    function chain(...args) {
      const wrap2 = (a, b) => (c) => a(b(c));
      const encode = Array.from(args).reverse().reduce((acc, i2) => acc ? wrap2(acc, i2.encode) : i2.encode, void 0);
      const decode2 = args.reduce((acc, i2) => acc ? wrap2(acc, i2.decode) : i2.decode, void 0);
      return { encode, decode: decode2 };
    }
    function alphabet(alphabet2) {
      return {
        encode: (digits) => {
          if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
            throw new Error("alphabet.encode input should be an array of numbers");
          return digits.map((i2) => {
            assertNumber(i2);
            if (i2 < 0 || i2 >= alphabet2.length)
              throw new Error(`Digit index outside alphabet: ${i2} (alphabet: ${alphabet2.length})`);
            return alphabet2[i2];
          });
        },
        decode: (input) => {
          if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
            throw new Error("alphabet.decode input should be array of strings");
          return input.map((letter) => {
            if (typeof letter !== "string")
              throw new Error(`alphabet.decode: not string element=${letter}`);
            const index = alphabet2.indexOf(letter);
            if (index === -1)
              throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet2}`);
            return index;
          });
        }
      };
    }
    function join(separator = "") {
      if (typeof separator !== "string")
        throw new Error("join separator should be string");
      return {
        encode: (from) => {
          if (!Array.isArray(from) || from.length && typeof from[0] !== "string")
            throw new Error("join.encode input should be array of strings");
          for (let i2 of from)
            if (typeof i2 !== "string")
              throw new Error(`join.encode: non-string input=${i2}`);
          return from.join(separator);
        },
        decode: (to) => {
          if (typeof to !== "string")
            throw new Error("join.decode input should be string");
          return to.split(separator);
        }
      };
    }
    function padding(bits, chr = "=") {
      assertNumber(bits);
      if (typeof chr !== "string")
        throw new Error("padding chr should be string");
      return {
        encode(data) {
          if (!Array.isArray(data) || data.length && typeof data[0] !== "string")
            throw new Error("padding.encode input should be array of strings");
          for (let i2 of data)
            if (typeof i2 !== "string")
              throw new Error(`padding.encode: non-string input=${i2}`);
          while (data.length * bits % 8)
            data.push(chr);
          return data;
        },
        decode(input) {
          if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
            throw new Error("padding.encode input should be array of strings");
          for (let i2 of input)
            if (typeof i2 !== "string")
              throw new Error(`padding.decode: non-string input=${i2}`);
          let end = input.length;
          if (end * bits % 8)
            throw new Error("Invalid padding: string should have whole number of bytes");
          for (; end > 0 && input[end - 1] === chr; end--) {
            if (!((end - 1) * bits % 8))
              throw new Error("Invalid padding: string has too much padding");
          }
          return input.slice(0, end);
        }
      };
    }
    function normalize(fn) {
      if (typeof fn !== "function")
        throw new Error("normalize fn should be function");
      return { encode: (from) => from, decode: (to) => fn(to) };
    }
    function convertRadix(data, from, to) {
      if (from < 2)
        throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
      if (to < 2)
        throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
      if (!Array.isArray(data))
        throw new Error("convertRadix: data should be array");
      if (!data.length)
        return [];
      let pos = 0;
      const res = [];
      const digits = Array.from(data);
      digits.forEach((d) => {
        assertNumber(d);
        if (d < 0 || d >= from)
          throw new Error(`Wrong integer: ${d}`);
      });
      while (true) {
        let carry = 0;
        let done = true;
        for (let i2 = pos; i2 < digits.length; i2++) {
          const digit = digits[i2];
          const digitBase = from * carry + digit;
          if (!Number.isSafeInteger(digitBase) || from * carry / from !== carry || digitBase - digit !== from * carry) {
            throw new Error("convertRadix: carry overflow");
          }
          carry = digitBase % to;
          digits[i2] = Math.floor(digitBase / to);
          if (!Number.isSafeInteger(digits[i2]) || digits[i2] * to + carry !== digitBase)
            throw new Error("convertRadix: carry overflow");
          if (!done)
            continue;
          else if (!digits[i2])
            pos = i2;
          else
            done = false;
        }
        res.push(carry);
        if (done)
          break;
      }
      for (let i2 = 0; i2 < data.length - 1 && data[i2] === 0; i2++)
        res.push(0);
      return res.reverse();
    }
    const gcd = (a, b) => !b ? a : gcd(b, a % b);
    const radix2carry = (from, to) => from + (to - gcd(from, to));
    function convertRadix2(data, from, to, padding2) {
      if (!Array.isArray(data))
        throw new Error("convertRadix2: data should be array");
      if (from <= 0 || from > 32)
        throw new Error(`convertRadix2: wrong from=${from}`);
      if (to <= 0 || to > 32)
        throw new Error(`convertRadix2: wrong to=${to}`);
      if (radix2carry(from, to) > 32) {
        throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
      }
      let carry = 0;
      let pos = 0;
      const mask = 2 ** to - 1;
      const res = [];
      for (const n of data) {
        assertNumber(n);
        if (n >= 2 ** from)
          throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
        carry = carry << from | n;
        if (pos + from > 32)
          throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
        pos += from;
        for (; pos >= to; pos -= to)
          res.push((carry >> pos - to & mask) >>> 0);
        carry &= 2 ** pos - 1;
      }
      carry = carry << to - pos & mask;
      if (!padding2 && pos >= from)
        throw new Error("Excess padding");
      if (!padding2 && carry)
        throw new Error(`Non-zero padding: ${carry}`);
      if (padding2 && pos > 0)
        res.push(carry >>> 0);
      return res;
    }
    function radix(num) {
      assertNumber(num);
      return {
        encode: (bytes2) => {
          if (!(bytes2 instanceof Uint8Array))
            throw new Error("radix.encode input should be Uint8Array");
          return convertRadix(Array.from(bytes2), 2 ** 8, num);
        },
        decode: (digits) => {
          if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
            throw new Error("radix.decode input should be array of strings");
          return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
        }
      };
    }
    function radix2(bits, revPadding = false) {
      assertNumber(bits);
      if (bits <= 0 || bits > 32)
        throw new Error("radix2: bits should be in (0..32]");
      if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
        throw new Error("radix2: carry overflow");
      return {
        encode: (bytes2) => {
          if (!(bytes2 instanceof Uint8Array))
            throw new Error("radix2.encode input should be Uint8Array");
          return convertRadix2(Array.from(bytes2), 8, bits, !revPadding);
        },
        decode: (digits) => {
          if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
            throw new Error("radix2.decode input should be array of strings");
          return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
        }
      };
    }
    function unsafeWrapper(fn) {
      if (typeof fn !== "function")
        throw new Error("unsafeWrapper fn should be function");
      return function(...args) {
        try {
          return fn.apply(null, args);
        } catch (e) {
        }
      };
    }
    function checksum(len, fn) {
      assertNumber(len);
      if (typeof fn !== "function")
        throw new Error("checksum fn should be function");
      return {
        encode(data) {
          if (!(data instanceof Uint8Array))
            throw new Error("checksum.encode: input should be Uint8Array");
          const checksum2 = fn(data).slice(0, len);
          const res = new Uint8Array(data.length + len);
          res.set(data);
          res.set(checksum2, data.length);
          return res;
        },
        decode(data) {
          if (!(data instanceof Uint8Array))
            throw new Error("checksum.decode: input should be Uint8Array");
          const payload = data.slice(0, -len);
          const newChecksum = fn(payload).slice(0, len);
          const oldChecksum = data.slice(-len);
          for (let i2 = 0; i2 < len; i2++)
            if (newChecksum[i2] !== oldChecksum[i2])
              throw new Error("Invalid checksum");
          return payload;
        }
      };
    }
    exports.utils = { alphabet, chain, checksum, radix, radix2, join, padding };
    exports.base16 = chain(radix2(4), alphabet("0123456789ABCDEF"), join(""));
    exports.base32 = chain(radix2(5), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"), padding(5), join(""));
    exports.base32hex = chain(radix2(5), alphabet("0123456789ABCDEFGHIJKLMNOPQRSTUV"), padding(5), join(""));
    exports.base32crockford = chain(radix2(5), alphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ"), join(""), normalize((s) => s.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1")));
    exports.base64 = chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), padding(6), join(""));
    exports.base64url = chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"), padding(6), join(""));
    const genBase58 = (abc) => chain(radix(58), alphabet(abc), join(""));
    exports.base58 = genBase58("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    exports.base58flickr = genBase58("123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ");
    exports.base58xrp = genBase58("rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz");
    const XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
    exports.base58xmr = {
      encode(data) {
        let res = "";
        for (let i2 = 0; i2 < data.length; i2 += 8) {
          const block = data.subarray(i2, i2 + 8);
          res += exports.base58.encode(block).padStart(XMR_BLOCK_LEN[block.length], "1");
        }
        return res;
      },
      decode(str) {
        let res = [];
        for (let i2 = 0; i2 < str.length; i2 += 11) {
          const slice = str.slice(i2, i2 + 11);
          const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
          const block = exports.base58.decode(slice);
          for (let j = 0; j < block.length - blockLen; j++) {
            if (block[j] !== 0)
              throw new Error("base58xmr: wrong padding");
          }
          res = res.concat(Array.from(block.slice(block.length - blockLen)));
        }
        return Uint8Array.from(res);
      }
    };
    const base58check = (sha2562) => chain(checksum(4, (data) => sha2562(sha2562(data))), exports.base58);
    exports.base58check = base58check;
    const BECH_ALPHABET = chain(alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), join(""));
    const POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
    function bech32Polymod(pre) {
      const b = pre >> 25;
      let chk = (pre & 33554431) << 5;
      for (let i2 = 0; i2 < POLYMOD_GENERATORS.length; i2++) {
        if ((b >> i2 & 1) === 1)
          chk ^= POLYMOD_GENERATORS[i2];
      }
      return chk;
    }
    function bechChecksum(prefix, words, encodingConst = 1) {
      const len = prefix.length;
      let chk = 1;
      for (let i2 = 0; i2 < len; i2++) {
        const c = prefix.charCodeAt(i2);
        if (c < 33 || c > 126)
          throw new Error(`Invalid prefix (${prefix})`);
        chk = bech32Polymod(chk) ^ c >> 5;
      }
      chk = bech32Polymod(chk);
      for (let i2 = 0; i2 < len; i2++)
        chk = bech32Polymod(chk) ^ prefix.charCodeAt(i2) & 31;
      for (let v of words)
        chk = bech32Polymod(chk) ^ v;
      for (let i2 = 0; i2 < 6; i2++)
        chk = bech32Polymod(chk);
      chk ^= encodingConst;
      return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
    }
    function genBech32(encoding) {
      const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
      const _words = radix2(5);
      const fromWords = _words.decode;
      const toWords = _words.encode;
      const fromWordsUnsafe = unsafeWrapper(fromWords);
      function encode(prefix, words, limit = 90) {
        if (typeof prefix !== "string")
          throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
        if (!Array.isArray(words) || words.length && typeof words[0] !== "number")
          throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
        const actualLength = prefix.length + 7 + words.length;
        if (limit !== false && actualLength > limit)
          throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
        prefix = prefix.toLowerCase();
        return `${prefix}1${BECH_ALPHABET.encode(words)}${bechChecksum(prefix, words, ENCODING_CONST)}`;
      }
      function decode2(str, limit = 90) {
        if (typeof str !== "string")
          throw new Error(`bech32.decode input should be string, not ${typeof str}`);
        if (str.length < 8 || limit !== false && str.length > limit)
          throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
        const lowered = str.toLowerCase();
        if (str !== lowered && str !== str.toUpperCase())
          throw new Error(`String must be lowercase or uppercase`);
        str = lowered;
        const sepIndex = str.lastIndexOf("1");
        if (sepIndex === 0 || sepIndex === -1)
          throw new Error(`Letter "1" must be present between prefix and data only`);
        const prefix = str.slice(0, sepIndex);
        const _words2 = str.slice(sepIndex + 1);
        if (_words2.length < 6)
          throw new Error("Data must be at least 6 characters long");
        const words = BECH_ALPHABET.decode(_words2).slice(0, -6);
        const sum = bechChecksum(prefix, words, ENCODING_CONST);
        if (!_words2.endsWith(sum))
          throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
        return { prefix, words };
      }
      const decodeUnsafe = unsafeWrapper(decode2);
      function decodeToBytes(str) {
        const { prefix, words } = decode2(str, false);
        return { prefix, words, bytes: fromWords(words) };
      }
      return { encode, decode: decode2, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
    }
    exports.bech32 = genBech32("bech32");
    exports.bech32m = genBech32("bech32m");
    exports.utf8 = {
      encode: (data) => new TextDecoder().decode(data),
      decode: (str) => new TextEncoder().encode(str)
    };
    exports.hex = chain(radix2(4), alphabet("0123456789abcdef"), join(""), normalize((s) => {
      if (typeof s !== "string" || s.length % 2)
        throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
      return s.toLowerCase();
    }));
    const CODERS = {
      utf8: exports.utf8,
      hex: exports.hex,
      base16: exports.base16,
      base32: exports.base32,
      base64: exports.base64,
      base64url: exports.base64url,
      base58: exports.base58,
      base58xmr: exports.base58xmr
    };
    const coderTypeError = `Invalid encoding type. Available types: ${Object.keys(CODERS).join(", ")}`;
    const bytesToString = (type, bytes2) => {
      if (typeof type !== "string" || !CODERS.hasOwnProperty(type))
        throw new TypeError(coderTypeError);
      if (!(bytes2 instanceof Uint8Array))
        throw new TypeError("bytesToString() expects Uint8Array");
      return CODERS[type].encode(bytes2);
    };
    exports.bytesToString = bytesToString;
    exports.str = exports.bytesToString;
    const stringToBytes = (type, str) => {
      if (!CODERS.hasOwnProperty(type))
        throw new TypeError(coderTypeError);
      if (typeof str !== "string")
        throw new TypeError("stringToBytes() expects string");
      return CODERS[type].decode(str);
    };
    exports.stringToBytes = stringToBytes;
    exports.bytes = exports.stringToBytes;
  })(lib);
  var utf8Decoder$1 = new TextDecoder("utf-8");
  new TextEncoder();
  var Bech32MaxSize$1 = 5e3;
  function decode$2(nip19) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    let { prefix, words } = lib.bech32.decode(nip19, Bech32MaxSize$1);
    let data = new Uint8Array(lib.bech32.fromWords(words));
    switch (prefix) {
      case "nprofile": {
        let tlv = parseTLV$1(data);
        if (!((_a2 = tlv[0]) == null ? void 0 : _a2[0]))
          throw new Error("missing TLV 0 for nprofile");
        if (tlv[0][0].length !== 32)
          throw new Error("TLV 0 should be 32 bytes");
        return {
          type: "nprofile",
          data: {
            pubkey: bytesToHex(tlv[0][0]),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder$1.decode(d)) : []
          }
        };
      }
      case "nevent": {
        let tlv = parseTLV$1(data);
        if (!((_b2 = tlv[0]) == null ? void 0 : _b2[0]))
          throw new Error("missing TLV 0 for nevent");
        if (tlv[0][0].length !== 32)
          throw new Error("TLV 0 should be 32 bytes");
        if (tlv[2] && tlv[2][0].length !== 32)
          throw new Error("TLV 2 should be 32 bytes");
        if (tlv[3] && tlv[3][0].length !== 4)
          throw new Error("TLV 3 should be 4 bytes");
        return {
          type: "nevent",
          data: {
            id: bytesToHex(tlv[0][0]),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder$1.decode(d)) : [],
            author: ((_c = tlv[2]) == null ? void 0 : _c[0]) ? bytesToHex(tlv[2][0]) : void 0,
            kind: ((_d = tlv[3]) == null ? void 0 : _d[0]) ? parseInt(bytesToHex(tlv[3][0]), 16) : void 0
          }
        };
      }
      case "naddr": {
        let tlv = parseTLV$1(data);
        if (!((_e = tlv[0]) == null ? void 0 : _e[0]))
          throw new Error("missing TLV 0 for naddr");
        if (!((_f = tlv[2]) == null ? void 0 : _f[0]))
          throw new Error("missing TLV 2 for naddr");
        if (tlv[2][0].length !== 32)
          throw new Error("TLV 2 should be 32 bytes");
        if (!((_g = tlv[3]) == null ? void 0 : _g[0]))
          throw new Error("missing TLV 3 for naddr");
        if (tlv[3][0].length !== 4)
          throw new Error("TLV 3 should be 4 bytes");
        return {
          type: "naddr",
          data: {
            identifier: utf8Decoder$1.decode(tlv[0][0]),
            pubkey: bytesToHex(tlv[2][0]),
            kind: parseInt(bytesToHex(tlv[3][0]), 16),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder$1.decode(d)) : []
          }
        };
      }
      case "nrelay": {
        let tlv = parseTLV$1(data);
        if (!((_h = tlv[0]) == null ? void 0 : _h[0]))
          throw new Error("missing TLV 0 for nrelay");
        return {
          type: "nrelay",
          data: utf8Decoder$1.decode(tlv[0][0])
        };
      }
      case "nsec":
        return { type: prefix, data };
      case "npub":
      case "note":
        return { type: prefix, data: bytesToHex(data) };
      default:
        throw new Error(`unknown prefix ${prefix}`);
    }
  }
  function parseTLV$1(data) {
    let result = {};
    let rest = data;
    while (rest.length > 0) {
      let t = rest[0];
      let l = rest[1];
      let v = rest.slice(2, 2 + l);
      rest = rest.slice(2 + l);
      if (v.length < l)
        throw new Error(`not enough data to read on TLV ${t}`);
      result[t] = result[t] || [];
      result[t].push(v);
    }
    return result;
  }
  function npubEncode(hex2) {
    return encodeBytes("npub", hexToBytes(hex2));
  }
  function noteEncode(hex2) {
    return encodeBytes("note", hexToBytes(hex2));
  }
  function encodeBech32(prefix, data) {
    let words = lib.bech32.toWords(data);
    return lib.bech32.encode(prefix, words, Bech32MaxSize$1);
  }
  function encodeBytes(prefix, bytes2) {
    return encodeBech32(prefix, bytes2);
  }
  var utf8Decoder = new TextDecoder("utf-8");
  new TextEncoder();
  var Bech32MaxSize = 5e3;
  var BECH32_REGEX = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/;
  function decode$1(nip19) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    let { prefix, words } = lib.bech32.decode(nip19, Bech32MaxSize);
    let data = new Uint8Array(lib.bech32.fromWords(words));
    switch (prefix) {
      case "nprofile": {
        let tlv = parseTLV(data);
        if (!((_a2 = tlv[0]) == null ? void 0 : _a2[0]))
          throw new Error("missing TLV 0 for nprofile");
        if (tlv[0][0].length !== 32)
          throw new Error("TLV 0 should be 32 bytes");
        return {
          type: "nprofile",
          data: {
            pubkey: bytesToHex(tlv[0][0]),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
          }
        };
      }
      case "nevent": {
        let tlv = parseTLV(data);
        if (!((_b2 = tlv[0]) == null ? void 0 : _b2[0]))
          throw new Error("missing TLV 0 for nevent");
        if (tlv[0][0].length !== 32)
          throw new Error("TLV 0 should be 32 bytes");
        if (tlv[2] && tlv[2][0].length !== 32)
          throw new Error("TLV 2 should be 32 bytes");
        if (tlv[3] && tlv[3][0].length !== 4)
          throw new Error("TLV 3 should be 4 bytes");
        return {
          type: "nevent",
          data: {
            id: bytesToHex(tlv[0][0]),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
            author: ((_c = tlv[2]) == null ? void 0 : _c[0]) ? bytesToHex(tlv[2][0]) : void 0,
            kind: ((_d = tlv[3]) == null ? void 0 : _d[0]) ? parseInt(bytesToHex(tlv[3][0]), 16) : void 0
          }
        };
      }
      case "naddr": {
        let tlv = parseTLV(data);
        if (!((_e = tlv[0]) == null ? void 0 : _e[0]))
          throw new Error("missing TLV 0 for naddr");
        if (!((_f = tlv[2]) == null ? void 0 : _f[0]))
          throw new Error("missing TLV 2 for naddr");
        if (tlv[2][0].length !== 32)
          throw new Error("TLV 2 should be 32 bytes");
        if (!((_g = tlv[3]) == null ? void 0 : _g[0]))
          throw new Error("missing TLV 3 for naddr");
        if (tlv[3][0].length !== 4)
          throw new Error("TLV 3 should be 4 bytes");
        return {
          type: "naddr",
          data: {
            identifier: utf8Decoder.decode(tlv[0][0]),
            pubkey: bytesToHex(tlv[2][0]),
            kind: parseInt(bytesToHex(tlv[3][0]), 16),
            relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
          }
        };
      }
      case "nrelay": {
        let tlv = parseTLV(data);
        if (!((_h = tlv[0]) == null ? void 0 : _h[0]))
          throw new Error("missing TLV 0 for nrelay");
        return {
          type: "nrelay",
          data: utf8Decoder.decode(tlv[0][0])
        };
      }
      case "nsec":
        return { type: prefix, data };
      case "npub":
      case "note":
        return { type: prefix, data: bytesToHex(data) };
      default:
        throw new Error(`unknown prefix ${prefix}`);
    }
  }
  function parseTLV(data) {
    let result = {};
    let rest = data;
    while (rest.length > 0) {
      let t = rest[0];
      let l = rest[1];
      let v = rest.slice(2, 2 + l);
      rest = rest.slice(2 + l);
      if (v.length < l)
        throw new Error(`not enough data to read on TLV ${t}`);
      result[t] = result[t] || [];
      result[t].push(v);
    }
    return result;
  }
  var NOSTR_URI_REGEX = new RegExp(`nostr:(${BECH32_REGEX.source})`);
  var regex = () => new RegExp(`\\b${NOSTR_URI_REGEX.source}\\b`, "g");
  function* matchAll(content) {
    const matches = content.matchAll(regex());
    for (const match of matches) {
      try {
        const [uri, value] = match;
        yield {
          uri,
          value,
          decoded: decode$1(value),
          start: match.index,
          end: match.index + uri.length
        };
      } catch (_e) {
      }
    }
  }
  function replaceAll(content, replacer) {
    return content.replaceAll(regex(), (uri, value) => {
      return replacer({
        uri,
        value,
        decoded: decode$1(value)
      });
    });
  }
  var nanomd_min = { exports: {} };
  (function(module, exports) {
    !function(a, b) {
      module.exports = b();
    }(commonjsGlobal, function() {
      function a(a2) {
        return a2.replace(/\\([(){}[\]#*+\-.!_\\])/g, function(a3, b2) {
          return String.fromCharCode(1, c.indexOf(b2) + d);
        }).replace(/(\*\*|__|~~)(\S(?:[\s\S]*?\S)?)\1/g, function(a3, b2, c2) {
          return "~~" === b2 ? "<del>" + c2 + "</del>" : "<b>" + c2 + "</b>";
        }).replace(/(\n|^|\W)([_\*])(\S(?:[\s\S]*?\S)?)\2(\W|$|\n)/g, function(a3, b2, c2, d2, e2) {
          return b2 + "<i>" + d2 + "</i>" + e2;
        }).replace(/(!?)\[([^\]<>]+)\]\((\+?)([^ \)<>]+)(?: "([^\(\)\"]+)")?\)/g, function(a3, b2, c2, d2, f, g) {
          var h = g ? ' title="' + g + '"' : "";
          return b2 ? '<img src="' + e.href(f) + '" alt="' + c2 + '"' + h + "/>" : (d2 && (h += ' target="_blank"'), '<a href="' + e.href(f) + '"' + h + ">" + c2 + "</a>");
        });
      }
      function b(a2) {
        return a2.replace(/\x01([\x0f-\x1c])/g, function(a3, b2) {
          return c.charAt(b2.charCodeAt(0) - d);
        });
      }
      var c = "\\[!]#{()}*+-._", d = 16, e = function(c2) {
        return c2.replace(/.+(?:\n.+)*/g, function(c3) {
          var d2 = /^\s{4}([^]*)$/.exec(c3);
          if (d2)
            return "<pre><code>" + d2[1].replace(/\n    /g, "\n") + "</code></pre>";
          for (var f, g = [], h = a(c3).split("\n"), i2 = 0, j = h.length; j > i2; ++i2) {
            var k = h[i2], l = /^\s{0,3}(\#{1,6})\s+(.*?)\s*#*\s*$/.exec(k);
            if (l)
              g.push(f = [l[2], "h", l[1].length]);
            else {
              var m = /^(\s*)(?:[-*]|(\d[.)])) (.+)$/.exec(k);
              m ? g.push(f = [m[3], m[2] ? "ol" : "ul", m[1].length]) : /^\s{0,3}([-])(\s*\1){2,}\s*$/.test(k) ? g.push(f = ["", "hr"]) : f && "hr" !== f[1] && "h" !== f[1] ? f[0] += "\n" + k : g.push(f = [k, "p", ""]);
            }
          }
          var n = "", o = [];
          for (i2 = 0, j = g.length; j > i2; ++i2) {
            f = g[i2];
            var p = f[0], q = f[1], r = f[2];
            if ("ul" === q || "ol" === q)
              !o.length || r > o[0][1] ? (o.unshift([q, r]), n += "<" + o[0][0] + "><li>" + p) : o.length > 1 && r <= o[1][1] ? (n += "</li></" + o.shift()[0] + ">", --i2) : n += "</li><li>" + p;
            else {
              for (; o.length; )
                n += "</li></" + o.shift()[0] + ">";
              n += "hr" === q ? "<hr/>" : "<" + q + r + e.headAttrs(r, p) + ">" + p + "</" + q + r + ">";
            }
          }
          for (; o.length; )
            n += "</li></" + o.shift()[0] + ">";
          return b(n);
        });
      };
      return e.href = function(a2) {
        return a2;
      }, e.headAttrs = function(a2, b2) {
        return "";
      }, e;
    });
  })(nanomd_min);
  var nanomd_minExports = nanomd_min.exports;
  const nmd = /* @__PURE__ */ getDefaultExportFromCjs(nanomd_minExports);
  function createDelay(interval) {
    return async () => new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }
  function batchedFunction(function_, { delay = void 0 } = {}) {
    if (typeof delay !== "number" && delay !== void 0) {
      throw new TypeError(`Expected \`interval\` to be of type \`number\` but received type \`${typeof delay}\``);
    }
    const queueCall = delay === void 0 ? async () => void 0 : createDelay(delay);
    let queue = [];
    return (value) => {
      queue.push(value);
      if (queue.length === 1) {
        (async () => {
          await queueCall();
          function_(queue);
          queue = [];
        })();
      }
    };
  }
  const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
  let idbProxyableTypes;
  let cursorAdvanceMethods;
  function getIdbProxyableTypes() {
    return idbProxyableTypes || (idbProxyableTypes = [
      IDBDatabase,
      IDBObjectStore,
      IDBIndex,
      IDBCursor,
      IDBTransaction
    ]);
  }
  function getCursorAdvanceMethods() {
    return cursorAdvanceMethods || (cursorAdvanceMethods = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey
    ]);
  }
  const cursorRequestMap = /* @__PURE__ */ new WeakMap();
  const transactionDoneMap = /* @__PURE__ */ new WeakMap();
  const transactionStoreNamesMap = /* @__PURE__ */ new WeakMap();
  const transformCache = /* @__PURE__ */ new WeakMap();
  const reverseTransformCache = /* @__PURE__ */ new WeakMap();
  function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
      const unlisten = () => {
        request.removeEventListener("success", success);
        request.removeEventListener("error", error);
      };
      const success = () => {
        resolve(wrap(request.result));
        unlisten();
      };
      const error = () => {
        reject(request.error);
        unlisten();
      };
      request.addEventListener("success", success);
      request.addEventListener("error", error);
    });
    promise.then((value) => {
      if (value instanceof IDBCursor) {
        cursorRequestMap.set(value, request);
      }
    }).catch(() => {
    });
    reverseTransformCache.set(promise, request);
    return promise;
  }
  function cacheDonePromiseForTransaction(tx) {
    if (transactionDoneMap.has(tx))
      return;
    const done = new Promise((resolve, reject) => {
      const unlisten = () => {
        tx.removeEventListener("complete", complete);
        tx.removeEventListener("error", error);
        tx.removeEventListener("abort", error);
      };
      const complete = () => {
        resolve();
        unlisten();
      };
      const error = () => {
        reject(tx.error || new DOMException("AbortError", "AbortError"));
        unlisten();
      };
      tx.addEventListener("complete", complete);
      tx.addEventListener("error", error);
      tx.addEventListener("abort", error);
    });
    transactionDoneMap.set(tx, done);
  }
  let idbProxyTraps = {
    get(target, prop, receiver) {
      if (target instanceof IDBTransaction) {
        if (prop === "done")
          return transactionDoneMap.get(target);
        if (prop === "objectStoreNames") {
          return target.objectStoreNames || transactionStoreNamesMap.get(target);
        }
        if (prop === "store") {
          return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
        }
      }
      return wrap(target[prop]);
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
        return true;
      }
      return prop in target;
    }
  };
  function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
  }
  function wrapFunction(func) {
    if (func === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype)) {
      return function(storeNames, ...args) {
        const tx = func.call(unwrap(this), storeNames, ...args);
        transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
        return wrap(tx);
      };
    }
    if (getCursorAdvanceMethods().includes(func)) {
      return function(...args) {
        func.apply(unwrap(this), args);
        return wrap(cursorRequestMap.get(this));
      };
    }
    return function(...args) {
      return wrap(func.apply(unwrap(this), args));
    };
  }
  function transformCachableValue(value) {
    if (typeof value === "function")
      return wrapFunction(value);
    if (value instanceof IDBTransaction)
      cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
      return new Proxy(value, idbProxyTraps);
    return value;
  }
  function wrap(value) {
    if (value instanceof IDBRequest)
      return promisifyRequest(value);
    if (transformCache.has(value))
      return transformCache.get(value);
    const newValue = transformCachableValue(value);
    if (newValue !== value) {
      transformCache.set(value, newValue);
      reverseTransformCache.set(newValue, value);
    }
    return newValue;
  }
  const unwrap = (value) => reverseTransformCache.get(value);
  function openDB(name, version, { blocked, upgrade: upgrade2, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade2) {
      request.addEventListener("upgradeneeded", (event) => {
        upgrade2(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
      });
    }
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event.newVersion,
        event
      ));
    }
    openPromise.then((db2) => {
      if (terminated)
        db2.addEventListener("close", () => terminated());
      if (blocking) {
        db2.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
      }
    }).catch(() => {
    });
    return openPromise;
  }
  const readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
  const writeMethods = ["put", "add", "delete", "clear"];
  const cachedMethods = /* @__PURE__ */ new Map();
  function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
      return;
    }
    if (cachedMethods.get(prop))
      return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, "");
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
      // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
      !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
    ) {
      return;
    }
    const method = async function(storeName, ...args) {
      const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
      let target2 = tx.store;
      if (useIndex)
        target2 = target2.index(args.shift());
      return (await Promise.all([
        target2[targetFuncName](...args),
        isWrite && tx.done
      ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
  }
  replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
  }));
  function parse(event) {
    const result = {
      reply: void 0,
      root: void 0,
      mentions: [],
      profiles: []
    };
    const eTags = [];
    for (const tag of event.tags) {
      if (tag[0] === "e" && tag[1]) {
        eTags.push(tag);
      }
      if (tag[0] === "p" && tag[1]) {
        result.profiles.push({
          pubkey: tag[1],
          relays: tag[2] ? [tag[2]] : []
        });
      }
    }
    for (let eTagIndex = 0; eTagIndex < eTags.length; eTagIndex++) {
      const eTag = eTags[eTagIndex];
      const [_, eTagEventId, eTagRelayUrl, eTagMarker] = eTag;
      const eventPointer = {
        id: eTagEventId,
        relays: eTagRelayUrl ? [eTagRelayUrl] : []
      };
      const isFirstETag = eTagIndex === 0;
      const isLastETag = eTagIndex === eTags.length - 1;
      if (eTagMarker === "root") {
        result.root = eventPointer;
        continue;
      }
      if (eTagMarker === "reply") {
        result.reply = eventPointer;
        continue;
      }
      if (eTagMarker === "mention") {
        result.mentions.push(eventPointer);
        continue;
      }
      if (isFirstETag) {
        result.root = eventPointer;
        continue;
      }
      if (isLastETag) {
        result.reply = eventPointer;
        continue;
      }
      result.mentions.push(eventPointer);
    }
    return result;
  }
  const voteKind = (r) => {
    if (r.content === "-") {
      return -1;
    } else if (r.content.length === 0 || r.content === "+") {
      return 1;
    } else {
      return 0;
    }
  };
  const indices = {
    "events": "id",
    "reactions": "eid",
    "aggregates": ["eid", "k"],
    "profiles": ["pk"],
    "relays": ["n", "a"],
    "relayInfos": "name"
  };
  const upgrade = async (db2, currentVersion) => {
    if (currentVersion <= 1) {
      const names = [...db2.objectStoreNames];
      await Promise.all(names.map((n) => db2.deleteObjectStore(n)));
    }
    const events = db2.createObjectStore("events", { keyPath: indices["events"] });
    events.createIndex("a", "a");
    events.createIndex("ro", "ro");
    events.createIndex("r", "r");
    events.createIndex("d", "d");
    events.createIndex("k", "k");
    const reactions = db2.createObjectStore("reactions", { keyPath: indices["reactions"] });
    reactions.createIndex("by-eid", "eid");
    db2.createObjectStore("aggregates", { keyPath: indices["aggregates"] });
    const profiles = db2.createObjectStore("profiles", { keyPath: indices["profiles"] });
    profiles.createIndex("l", "l");
    const relays = db2.createObjectStore("relays", { keyPath: indices["relays"] });
    relays.createIndex("a", "a");
    const relayInfos = db2.createObjectStore("relayInfos", { keyPath: indices["relayInfos"] });
    relayInfos.createIndex("by-name", "name");
  };
  const eventToNoteEvent = (e) => {
    var _a2, _b2;
    const nip10result = parse(e);
    const aTag = e.tags.find((t2) => t2[0] === "a");
    const a = aTag && aTag[1];
    const am = aTag && aTag[3] === "mention";
    const rTag = e.tags.find((t2) => t2[0] === "r");
    const r = rTag && rTag[1];
    const tTags = e.tags.filter((t2) => t2[0] === "t");
    const t = [...new Set(tTags.map((t2) => t2[1]))];
    const dTag = e.tags.find((t2) => t2[0] === "d");
    const d = dTag && dTag[1];
    const titleTag = e.tags.find((t2) => t2[0] === "title");
    const tl = titleTag && titleTag[1];
    const nonce = e.tags.find((t2) => t2.length > 2 && t2[0] === "nonce");
    const pow3 = nonce && +nonce[2] || 0;
    return {
      id: e.id ?? "",
      k: e.kind,
      c: e.content,
      ts: e.created_at,
      pk: e.pubkey,
      ro: (_a2 = nip10result.root) == null ? void 0 : _a2.id,
      re: (_b2 = nip10result.reply) == null ? void 0 : _b2.id,
      me: nip10result.mentions.map((m) => m.id),
      p: nip10result.profiles.map((p) => p.pubkey),
      a,
      am,
      r,
      t,
      d,
      tl,
      pow: pow3
    };
  };
  const eventToReactionEvent = (e) => {
    parse(e);
    const eTags = e.tags.filter((t) => t.length > 1 && t[0] === "e");
    const tags = eTags.filter((t) => t.length > 2);
    const noteId = tags.filter((t) => t[3] === "reply").concat(tags.filter((t) => t[3] === "root")).map((t) => t[1]).concat(eTags.length > 0 && eTags[0].length > 1 && [eTags[0][1]] || [])[0];
    const nonce = e.tags.find((t) => t.length > 2 && t[0] === "nonce");
    const pow3 = nonce && +nonce[2] || 0;
    return {
      eid: e.id ?? "",
      noteId,
      pk: e.pubkey,
      content: e.content,
      ts: e.created_at,
      pow: pow3
    };
  };
  const inMemoryDatabaseFactory = () => ({});
  let memDb = inMemoryDatabaseFactory();
  let _retryOpenDatabase = true;
  let __db;
  const db = async () => {
    if (_retryOpenDatabase === false) {
      return;
    }
    try {
      if (!__db) {
        __db = await openDB("zapthreads", 2, { upgrade });
      }
      return __db;
    } catch (e) {
      _retryOpenDatabase = false;
    }
  };
  const watchAll = (cb) => {
    const get = createMemo(on(cb, () => {
      const [type, query, options] = cb();
      const fetchData = () => findAll(type, query, options);
      const [resource, { mutate }] = createResource(() => sigStore[type], fetchData, {
        initialValue: [],
        storage: createDeepSignal
      });
      findAll(type, query, options).then(mutate);
      return resource;
    }));
    return () => get()();
  };
  const watch = (cb) => {
    const get = createMemo(on(cb, () => {
      const [type, query, options] = cb();
      const fetchData = () => find(type, query, options);
      const [resource, { mutate }] = createResource(() => sigStore[type], fetchData, {
        initialValue: void 0,
        storage: createDeepSignal
      });
      find(type, query, options).then(mutate);
      return resource;
    }));
    return () => get()();
  };
  const findAll = async (type, query, options) => {
    const _db = await db();
    if (!_db) {
      const map = memDb[type];
      if (map) {
        if (options) {
          const values = Array.isArray(query) ? query : [query];
          return Object.values(map).filter((e) => values.includes(e[options.index]));
        }
        return Object.values(map);
      }
      return [];
    }
    if (query && options) {
      if (Array.isArray(query)) {
        const queries = query.map((value) => _db.getAllFromIndex(type, options.index, value));
        const resolved = await Promise.all(queries);
        return resolved.flat();
      }
      return _db.getAllFromIndex(type, options.index, query);
    }
    return _db.getAll(type);
  };
  const find = async (type, query, options) => {
    const _db = await db();
    if (!_db) {
      const map = memDb[type];
      if (map) {
        if (options) {
          return Object.values(map).find((e) => e[options.index] === query);
        }
        const idx = (query.lower ? query.lower : query).toString();
        return map[idx];
      }
      return;
    }
    if (options) {
      return _db.getFromIndex(type, options.index, query);
    }
    return _db.get(type, query);
  };
  const batchFns = {};
  const _saveToMemoryDatabase = (type, models) => {
    memDb[type] ?? (memDb[type] = {});
    for (const model of models) {
      let indicesForType = indices[type];
      indicesForType = Array.isArray(indicesForType) ? indicesForType : [indicesForType];
      const indexValue = indicesForType.map((index) => model[index]).join(",");
      memDb[type][indexValue] = model;
    }
  };
  const _removeFromMemoryDatabase = (type, query) => {
    const map = memDb[type];
    if (map) {
      const idx = (query.lower ? query.lower : query).toString();
      delete map[idx];
    }
  };
  const save = async (type, model, options = { immediate: false }) => {
    const _db = await db();
    if (options.immediate) {
      if (!_db) {
        _saveToMemoryDatabase(type, [model]);
      } else {
        _db.put(type, model);
      }
      sigStore[type] = +/* @__PURE__ */ new Date();
      return;
    }
    batchFns[type] || (batchFns[type] = batchedFunction(async (models) => {
      if (!_db) {
        _saveToMemoryDatabase(type, models);
        sigStore[type] = +/* @__PURE__ */ new Date();
        return;
      }
      const tx = _db.transaction(type, "readwrite");
      const result = await Promise.all([...models.map((e) => tx.store.put(e)), tx.done]);
      if (result) {
        sigStore[type] = +/* @__PURE__ */ new Date();
      }
    }, { delay: 96 }));
    batchFns[type](model);
  };
  const remove = async (type, query, options = { immediate: true }) => {
    const _db = await db();
    let ok = true;
    if (options.immediate) {
      if (!_db) {
        _removeFromMemoryDatabase(type, query);
      } else {
        const tx = _db.transaction(type, "readwrite");
        ok = !!await Promise.all([...query.map((q) => tx.store.delete(q)), tx.done]);
      }
    } else {
      throw new Error("unimplemented");
    }
    if (ok) {
      sigStore[type] = +/* @__PURE__ */ new Date();
    }
  };
  const sigStore = createMutable({});
  function createDeepSignal(value) {
    const [store2, setStore] = createStore({
      value
    });
    return [
      () => store2.value,
      (v) => {
        const unwrapped = unwrap$1(store2.value);
        typeof v === "function" && (v = v(unwrapped));
        setStore("value", reconcile(v));
        return store2.value;
      }
    ];
  }
  const updateProfiles = async (pubkeys, relays, profiles) => {
    const now = +/* @__PURE__ */ new Date();
    const sixHours = 216e5;
    const pubkeysToUpdate = [...new Set(pubkeys)].filter((pubkey) => {
      const profile = profiles.find((p) => p.pk === pubkey);
      if ((profile == null ? void 0 : profile.l) && profile.l > now - sixHours) {
        return false;
      } else {
        return true;
      }
    }).filter((e) => !!e);
    if (pubkeysToUpdate.length === 0) {
      return;
    }
    const updatedProfiles = await pool.querySync(relays, {
      kinds: [0],
      authors: pubkeysToUpdate
    });
    for (const pubkey of pubkeysToUpdate) {
      const e = updatedProfiles.find((u) => u.pubkey === pubkey);
      if (e) {
        const payload = JSON.parse(e.content);
        const pubkey2 = e.pubkey;
        const updatedProfile = {
          pk: pubkey2,
          ts: e.created_at,
          i: payload.image || payload.picture,
          n: payload.displayName || payload.display_name || payload.name
        };
        const storedProfile = profiles.find((p) => p.pk === pubkey2);
        if (!storedProfile || !(storedProfile == null ? void 0 : storedProfile.n) || storedProfile.ts < updatedProfile.ts) {
          save("profiles", { ...updatedProfile, l: now });
        } else {
          save("profiles", { ...storedProfile, l: now });
        }
      }
    }
  };
  const getRelayLatest = async (anchor, relayNames) => {
    const relaysForAnchor = await findAll("relays", anchor.value, { index: "a" });
    const relaysLatest = relaysForAnchor.filter((r) => relayNames.includes(r.n)).map((t) => t.l);
    return relaysLatest.length > 0 ? Math.min(...relaysLatest) + 1 : 0;
  };
  const saveRelayLatestForFilter = async (anchor, events) => {
    const obj = {};
    for (const e of events) {
      const relaysForEvent = pool.seenOn.get(e.id);
      if (relaysForEvent) {
        for (const relay of relaysForEvent) {
          if (e.ts > (obj[relay.url] || 0)) {
            obj[relay.url] = e.ts;
          }
        }
      }
    }
    const relays = await findAll("relays", anchor.value, { index: "a" });
    for (const name in obj) {
      const relay = relays.find((r) => r.n === name);
      if (relay) {
        if (obj[name] > relay.l) {
          relay.l = obj[name];
          save("relays", relay);
        }
      } else {
        save("relays", { n: name, a: anchor.value, l: obj[name] });
      }
    }
  };
  const URL_REGEX = new RegExp("(?<=^|\\s)https?:\\/\\/[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&\\/\\/=]*)", "gi");
  const IMAGE_REGEX = /(\S*(?:png|jpg|jpeg|gif|webp))/gi;
  const BAD_NIP27_REGEX = new RegExp("(?<=^|\\s)@?((naddr|npub|nevent|note)[a-z0-9]{20,})", "g");
  const BACKTICKS_REGEX = /\`(.*?)\`/g;
  const ANY_HASHTAG = /\B\#([a-zA-Z0-9]+\b)(?!;)/g;
  const parseContent = (e, store2, articles = []) => {
    let content = e.c;
    const urlPrefixes = store2.urlPrefixes;
    const profiles = store2.profiles;
    content = content.replace(URL_REGEX, (url) => {
      if (url.match(IMAGE_REGEX)) {
        return `![image](${url})`;
      }
      return `[${url}](${url})`;
    });
    const hashtags = [...new Set(e.t)];
    if (hashtags.length > 0) {
      const re = new RegExp(`(^|\\s)\\#(${hashtags.join("|")})`, "gi");
      content = content.replaceAll(re, `$1[#$2](${urlPrefixes.tag}$2)`);
    }
    content = content.replaceAll(BAD_NIP27_REGEX, "nostr:$1");
    content = replaceAll(content, ({ decoded, value }) => {
      switch (decoded.type) {
        case "nprofile":
          let p1 = profiles().find((p) => p.pk === decoded.data.pubkey);
          const text1 = (p1 == null ? void 0 : p1.n) || shortenEncodedId(value);
          return `[@${text1}](${urlPrefixes.nprofile}${value})`;
        case "npub":
          let p2 = profiles().find((p) => p.pk === decoded.data);
          const text2 = (p2 == null ? void 0 : p2.n) || shortenEncodedId(value);
          return `[@${text2}](${urlPrefixes.npub}${value})`;
        case "note":
          return `[@${shortenEncodedId(value)}](${urlPrefixes.note}${value})`;
        case "naddr":
          const d = decoded.data;
          const article = articles.find((a) => a.pk === d.pubkey && a.d === d.identifier);
          if (article && article.tl) {
            return `[${article.tl}](${urlPrefixes.naddr}${value})`;
          }
          return `[@${shortenEncodedId(value)}](${urlPrefixes.naddr}${value})`;
        case "nevent":
          return `[@${shortenEncodedId(value)}](${urlPrefixes.nevent}${value})`;
        default:
          return value;
      }
    });
    content = content.replaceAll(BACKTICKS_REGEX, "<code>$1</code>");
    return nmd(content.trim());
  };
  const generateTags = (content) => {
    const result = [];
    const nostrMatches = matchAll(content);
    for (const m of nostrMatches) {
      if (m.decoded.type === "npub") {
        result.push(["p", m.decoded.data]);
      }
      if (m.decoded.type === "naddr") {
        const data = m.decoded.data;
        result.push(["a", `${data.kind}:${data.pubkey}:${data.identifier}`, "", "mention"]);
      }
      if (m.decoded.type === "nevent") {
        result.push(["e", m.decoded.data.id]);
      }
      if (m.decoded.type === "note") {
        result.push(["e", m.decoded.data]);
      }
    }
    const hashtagMatches = content.matchAll(ANY_HASHTAG);
    const hashtags = new Set([...hashtagMatches].map((m) => m[1].toLowerCase()));
    for (const t of hashtags) {
      result.push(["t", t]);
    }
    return result;
  };
  const parseUrlPrefixes = (value = "") => {
    const result = {
      naddr: "https://nostr.com/",
      npub: "https://nostr.com/",
      nprofile: "https://nostr.com/",
      nevent: "https://nostr.com/",
      note: "https://nostr.com/",
      tag: "https://snort.social/t/"
    };
    for (const pair of value.split(",")) {
      const [key, value2] = pair.split(":");
      if (value2) {
        result[key] = `https://${value2}`;
      }
    }
    return result;
  };
  const shortenEncodedId = (encoded) => {
    return encoded.substring(0, 8) + "..." + encoded.substring(encoded.length - 4);
  };
  const sortByDate = (arr) => arr.sort((a, b) => (a.ts || 0) >= (b.ts || 0) ? -1 : 1);
  const svgWidth = 20;
  const defaultPicture = 'data:image/svg+xml;utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="%23333" fill-rule="evenodd" /></svg>';
  const timeAgo = (timestamp) => {
    const now = /* @__PURE__ */ new Date();
    const secondsPast = Math.floor((now.getTime() - timestamp) / 1e3);
    if (secondsPast < 60) {
      return "now";
    }
    if (secondsPast < 3600) {
      const m = Math.floor(secondsPast / 60);
      return `${m} minute${m === 1 ? "" : "s"} ago`;
    }
    if (secondsPast <= 86400) {
      const h = Math.floor(secondsPast / 3600);
      return `${h} hour${h === 1 ? "" : "s"} ago`;
    }
    if (secondsPast <= 604800) {
      const d = Math.floor(secondsPast / 86400);
      return `${d} day${d === 1 ? "" : "s"} ago`;
    }
    if (secondsPast > 604800) {
      const date = new Date(timestamp);
      const day = date.toLocaleDateString("en-us", { day: "numeric", month: "long" });
      const year = date.getFullYear() === now.getFullYear() ? "" : " " + date.getFullYear();
      return "on " + day + year;
    }
    return "";
  };
  const satsAbbrev = (sats) => {
    if (sats < 1e4) {
      return sats.toString();
    } else if (sats < 1e6) {
      return Math.round(sats / 1e3) + "k";
    } else {
      return Math.round(sats / 1e6) + "M";
    }
  };
  const currentTime = () => Math.round(Date.now() / 1e3);
  const totalChildren = (event) => {
    return event.children.reduce((acc, c) => {
      return acc + totalChildren(c);
    }, event.children.length);
  };
  const removeSlashesRegex = /\/+$/;
  const normalizeURL$2 = (url, removeSlashes = true) => {
    const u = new URL(url);
    u.hash = "";
    if (removeSlashes) {
      u.pathname = u.pathname.replace(removeSlashesRegex, "");
    }
    return u.toString();
  };
  var verifiedSymbol$2 = Symbol("verified");
  var isRecord$2 = (obj) => obj instanceof Object;
  function validateEvent$2(event) {
    if (!isRecord$2(event))
      return false;
    if (typeof event.kind !== "number")
      return false;
    if (typeof event.content !== "string")
      return false;
    if (typeof event.created_at !== "number")
      return false;
    if (typeof event.pubkey !== "string")
      return false;
    if (!event.pubkey.match(/^[a-f0-9]{64}$/))
      return false;
    if (!Array.isArray(event.tags))
      return false;
    for (let i2 = 0; i2 < event.tags.length; i2++) {
      let tag = event.tags[i2];
      if (!Array.isArray(tag))
        return false;
      for (let j = 0; j < tag.length; j++) {
        if (typeof tag[j] === "object")
          return false;
      }
    }
    return true;
  }
  new TextDecoder("utf-8");
  var utf8Encoder$2 = new TextEncoder();
  var JS$2 = class JS {
    generateSecretKey() {
      return schnorr.utils.randomPrivateKey();
    }
    getPublicKey(secretKey) {
      return bytesToHex(schnorr.getPublicKey(secretKey));
    }
    finalizeEvent(t, secretKey) {
      const event = t;
      event.pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      event.id = getEventHash$2(event);
      event.sig = bytesToHex(schnorr.sign(getEventHash$2(event), secretKey));
      event[verifiedSymbol$2] = true;
      return event;
    }
    verifyEvent(event) {
      if (typeof event[verifiedSymbol$2] === "boolean")
        return event[verifiedSymbol$2];
      const hash2 = getEventHash$2(event);
      if (hash2 !== event.id) {
        event[verifiedSymbol$2] = false;
        return false;
      }
      try {
        const valid = schnorr.verify(event.sig, hash2, event.pubkey);
        event[verifiedSymbol$2] = valid;
        return valid;
      } catch (err) {
        event[verifiedSymbol$2] = false;
        return false;
      }
    }
  };
  function serializeEvent$2(evt) {
    if (!validateEvent$2(evt))
      throw new Error("can't serialize event with wrong or missing properties");
    return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
  }
  function getEventHash$2(event) {
    let eventHash = sha256(utf8Encoder$2.encode(serializeEvent$2(event)));
    return bytesToHex(eventHash);
  }
  var i$2 = new JS$2();
  i$2.generateSecretKey;
  i$2.getPublicKey;
  i$2.finalizeEvent;
  i$2.verifyEvent;
  var verifiedSymbol$1 = Symbol("verified");
  var isRecord$1 = (obj) => obj instanceof Object;
  function validateEvent$1(event) {
    if (!isRecord$1(event))
      return false;
    if (typeof event.kind !== "number")
      return false;
    if (typeof event.content !== "string")
      return false;
    if (typeof event.created_at !== "number")
      return false;
    if (typeof event.pubkey !== "string")
      return false;
    if (!event.pubkey.match(/^[a-f0-9]{64}$/))
      return false;
    if (!Array.isArray(event.tags))
      return false;
    for (let i2 = 0; i2 < event.tags.length; i2++) {
      let tag = event.tags[i2];
      if (!Array.isArray(tag))
        return false;
      for (let j = 0; j < tag.length; j++) {
        if (typeof tag[j] === "object")
          return false;
      }
    }
    return true;
  }
  new TextDecoder("utf-8");
  var utf8Encoder$1 = new TextEncoder();
  function normalizeURL$1(url) {
    if (url.indexOf("://") === -1)
      url = "wss://" + url;
    let p = new URL(url);
    p.pathname = p.pathname.replace(/\/+/g, "/");
    if (p.pathname.endsWith("/"))
      p.pathname = p.pathname.slice(0, -1);
    if (p.port === "80" && p.protocol === "ws:" || p.port === "443" && p.protocol === "wss:")
      p.port = "";
    p.searchParams.sort();
    p.hash = "";
    return p.toString();
  }
  var QueueNode = class {
    constructor(message) {
      __publicField(this, "value");
      __publicField(this, "next", null);
      __publicField(this, "prev", null);
      this.value = message;
    }
  };
  var Queue = class {
    constructor() {
      __publicField(this, "first");
      __publicField(this, "last");
      this.first = null;
      this.last = null;
    }
    enqueue(value) {
      const newNode = new QueueNode(value);
      if (!this.last) {
        this.first = newNode;
        this.last = newNode;
      } else if (this.last === this.first) {
        this.last = newNode;
        this.last.prev = this.first;
        this.first.next = newNode;
      } else {
        newNode.prev = this.last;
        this.last.next = newNode;
        this.last = newNode;
      }
      return true;
    }
    dequeue() {
      if (!this.first)
        return null;
      if (this.first === this.last) {
        const target2 = this.first;
        this.first = null;
        this.last = null;
        return target2.value;
      }
      const target = this.first;
      this.first = target.next;
      return target.value;
    }
  };
  var JS$1 = class JS {
    generateSecretKey() {
      return schnorr.utils.randomPrivateKey();
    }
    getPublicKey(secretKey) {
      return bytesToHex(schnorr.getPublicKey(secretKey));
    }
    finalizeEvent(t, secretKey) {
      const event = t;
      event.pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      event.id = getEventHash$1(event);
      event.sig = bytesToHex(schnorr.sign(getEventHash$1(event), secretKey));
      event[verifiedSymbol$1] = true;
      return event;
    }
    verifyEvent(event) {
      if (typeof event[verifiedSymbol$1] === "boolean")
        return event[verifiedSymbol$1];
      const hash2 = getEventHash$1(event);
      if (hash2 !== event.id) {
        event[verifiedSymbol$1] = false;
        return false;
      }
      try {
        const valid = schnorr.verify(event.sig, hash2, event.pubkey);
        event[verifiedSymbol$1] = valid;
        return valid;
      } catch (err) {
        event[verifiedSymbol$1] = false;
        return false;
      }
    }
  };
  function serializeEvent$1(evt) {
    if (!validateEvent$1(evt))
      throw new Error("can't serialize event with wrong or missing properties");
    return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
  }
  function getEventHash$1(event) {
    let eventHash = sha256(utf8Encoder$1.encode(serializeEvent$1(event)));
    return bytesToHex(eventHash);
  }
  var i$1 = new JS$1();
  i$1.generateSecretKey;
  i$1.getPublicKey;
  i$1.finalizeEvent;
  var verifyEvent = i$1.verifyEvent;
  var ClientAuth = 22242;
  function matchFilter(filter, event) {
    if (filter.ids && filter.ids.indexOf(event.id) === -1) {
      return false;
    }
    if (filter.kinds && filter.kinds.indexOf(event.kind) === -1) {
      return false;
    }
    if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
      return false;
    }
    for (let f in filter) {
      if (f[0] === "#") {
        let tagName = f.slice(1);
        let values = filter[`#${tagName}`];
        if (values && !event.tags.find(([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1))
          return false;
      }
    }
    if (filter.since && event.created_at < filter.since)
      return false;
    if (filter.until && event.created_at > filter.until)
      return false;
    return true;
  }
  function matchFilters(filters, event) {
    for (let i2 = 0; i2 < filters.length; i2++) {
      if (matchFilter(filters[i2], event)) {
        return true;
      }
    }
    return false;
  }
  function getHex64(json, field) {
    let len = field.length + 3;
    let idx = json.indexOf(`"${field}":`) + len;
    let s = json.slice(idx).indexOf(`"`) + idx + 1;
    return json.slice(s, s + 64);
  }
  function getSubscriptionId(json) {
    let idx = json.slice(0, 22).indexOf(`"EVENT"`);
    if (idx === -1)
      return null;
    let pstart = json.slice(idx + 7 + 1).indexOf(`"`);
    if (pstart === -1)
      return null;
    let start = idx + 7 + 1 + pstart;
    let pend = json.slice(start + 1, 80).indexOf(`"`);
    if (pend === -1)
      return null;
    let end = start + 1 + pend;
    return json.slice(start + 1, end);
  }
  function makeAuthEvent(relayURL, challenge2) {
    return {
      kind: ClientAuth,
      created_at: Math.floor(Date.now() / 1e3),
      tags: [
        ["relay", relayURL],
        ["challenge", challenge2]
      ],
      content: ""
    };
  }
  async function yieldThread() {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      const handler = () => {
        ch.port1.removeEventListener("message", handler);
        resolve();
      };
      ch.port1.addEventListener("message", handler);
      ch.port2.postMessage(0);
      ch.port1.start();
    });
  }
  var AbstractRelay = class {
    constructor(url, opts) {
      __publicField(this, "url");
      __publicField(this, "_connected", false);
      __publicField(this, "onclose", null);
      __publicField(this, "onnotice", (msg) => console.debug(`NOTICE from ${this.url}: ${msg}`));
      __publicField(this, "_onauth", null);
      __publicField(this, "baseEoseTimeout", 4400);
      __publicField(this, "connectionTimeout", 4400);
      __publicField(this, "openSubs", /* @__PURE__ */ new Map());
      __publicField(this, "connectionTimeoutHandle");
      __publicField(this, "connectionPromise");
      __publicField(this, "openCountRequests", /* @__PURE__ */ new Map());
      __publicField(this, "openEventPublishes", /* @__PURE__ */ new Map());
      __publicField(this, "ws");
      __publicField(this, "incomingMessageQueue", new Queue());
      __publicField(this, "queueRunning", false);
      __publicField(this, "challenge");
      __publicField(this, "serial", 0);
      __publicField(this, "verifyEvent");
      __publicField(this, "_WebSocket");
      this.url = normalizeURL$1(url);
      this.verifyEvent = opts.verifyEvent;
      this._WebSocket = opts.websocketImplementation || WebSocket;
    }
    static async connect(url, opts) {
      const relay = new AbstractRelay(url, opts);
      await relay.connect();
      return relay;
    }
    closeAllSubscriptions(reason) {
      for (let [_, sub] of this.openSubs) {
        sub.close(reason);
      }
      this.openSubs.clear();
      for (let [_, ep] of this.openEventPublishes) {
        ep.reject(new Error(reason));
      }
      this.openEventPublishes.clear();
      for (let [_, cr] of this.openCountRequests) {
        cr.reject(new Error(reason));
      }
      this.openCountRequests.clear();
    }
    get connected() {
      return this._connected;
    }
    async connect() {
      if (this.connectionPromise)
        return this.connectionPromise;
      this.challenge = void 0;
      this.connectionPromise = new Promise((resolve, reject) => {
        this.connectionTimeoutHandle = setTimeout(() => {
          var _a2;
          reject("connection timed out");
          this.connectionPromise = void 0;
          (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
          this.closeAllSubscriptions("relay connection timed out");
        }, this.connectionTimeout);
        try {
          this.ws = new this._WebSocket(this.url);
        } catch (err) {
          reject(err);
          return;
        }
        this.ws.onopen = () => {
          clearTimeout(this.connectionTimeoutHandle);
          this._connected = true;
          resolve();
        };
        this.ws.onerror = (ev) => {
          var _a2;
          reject(ev.message);
          if (this._connected) {
            this._connected = false;
            this.connectionPromise = void 0;
            (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
            this.closeAllSubscriptions("relay connection errored");
          }
        };
        this.ws.onclose = async () => {
          var _a2;
          if (this._connected) {
            this._connected = false;
            this.connectionPromise = void 0;
            (_a2 = this.onclose) == null ? void 0 : _a2.call(this);
            this.closeAllSubscriptions("relay connection closed");
          }
        };
        this.ws.onmessage = this._onmessage.bind(this);
      });
      return this.connectionPromise;
    }
    async runQueue() {
      this.queueRunning = true;
      while (true) {
        if (false === this.handleNext()) {
          break;
        }
        await yieldThread();
      }
      this.queueRunning = false;
    }
    handleNext() {
      var _a2, _b2, _c;
      const json = this.incomingMessageQueue.dequeue();
      if (!json) {
        return false;
      }
      const subid = getSubscriptionId(json);
      if (subid) {
        const so = this.openSubs.get(subid);
        if (!so) {
          return;
        }
        const id = getHex64(json, "id");
        const alreadyHave = (_a2 = so.alreadyHaveEvent) == null ? void 0 : _a2.call(so, id);
        (_b2 = so.receivedEvent) == null ? void 0 : _b2.call(so, this, id);
        if (alreadyHave) {
          return;
        }
      }
      try {
        let data = JSON.parse(json);
        switch (data[0]) {
          case "EVENT": {
            const so = this.openSubs.get(data[1]);
            const event = data[2];
            if (this.verifyEvent(event) && matchFilters(so.filters, event)) {
              so.onevent(event);
            }
            return;
          }
          case "COUNT": {
            const id = data[1];
            const payload = data[2];
            const cr = this.openCountRequests.get(id);
            if (cr) {
              cr.resolve(payload.count);
              this.openCountRequests.delete(id);
            }
            return;
          }
          case "EOSE": {
            const so = this.openSubs.get(data[1]);
            if (!so)
              return;
            so.receivedEose();
            return;
          }
          case "OK": {
            const id = data[1];
            const ok = data[2];
            const reason = data[3];
            const ep = this.openEventPublishes.get(id);
            if (ok)
              ep.resolve(reason);
            else
              ep.reject(new Error(reason));
            this.openEventPublishes.delete(id);
            return;
          }
          case "CLOSED": {
            const id = data[1];
            const so = this.openSubs.get(id);
            if (!so)
              return;
            so.closed = true;
            so.close(data[2]);
            return;
          }
          case "NOTICE":
            this.onnotice(data[1]);
            return;
          case "AUTH": {
            this.challenge = data[1];
            (_c = this._onauth) == null ? void 0 : _c.call(this, data[1]);
            return;
          }
        }
      } catch (err) {
        return;
      }
    }
    async send(message) {
      if (!this.connectionPromise)
        throw new Error("sending on closed connection");
      this.connectionPromise.then(() => {
        var _a2;
        (_a2 = this.ws) == null ? void 0 : _a2.send(message);
      });
    }
    async auth(signAuthEvent) {
      if (!this.challenge)
        throw new Error("can't perform auth, no challenge was received");
      const evt = await signAuthEvent(makeAuthEvent(this.url, this.challenge));
      const ret = new Promise((resolve, reject) => {
        this.openEventPublishes.set(evt.id, { resolve, reject });
      });
      this.send('["AUTH",' + JSON.stringify(evt) + "]");
      return ret;
    }
    async publish(event) {
      const ret = new Promise((resolve, reject) => {
        this.openEventPublishes.set(event.id, { resolve, reject });
      });
      this.send('["EVENT",' + JSON.stringify(event) + "]");
      return ret;
    }
    async count(filters, params) {
      this.serial++;
      const id = (params == null ? void 0 : params.id) || "count:" + this.serial;
      const ret = new Promise((resolve, reject) => {
        this.openCountRequests.set(id, { resolve, reject });
      });
      this.send('["COUNT","' + id + '",' + JSON.stringify(filters).substring(1));
      return ret;
    }
    subscribe(filters, params) {
      const subscription = this.prepareSubscription(filters, params);
      subscription.fire();
      return subscription;
    }
    prepareSubscription(filters, params) {
      this.serial++;
      const id = params.id || "sub:" + this.serial;
      const subscription = new Subscription(this, id, filters, params);
      this.openSubs.set(id, subscription);
      return subscription;
    }
    close() {
      var _a2;
      this.closeAllSubscriptions("relay connection closed by us");
      this._connected = false;
      (_a2 = this.ws) == null ? void 0 : _a2.close();
    }
    _onmessage(ev) {
      this.incomingMessageQueue.enqueue(ev.data);
      if (!this.queueRunning) {
        this.runQueue();
      }
    }
  };
  var Subscription = class {
    constructor(relay, id, filters, params) {
      __publicField(this, "relay");
      __publicField(this, "id");
      __publicField(this, "closed", false);
      __publicField(this, "eosed", false);
      __publicField(this, "filters");
      __publicField(this, "alreadyHaveEvent");
      __publicField(this, "receivedEvent");
      __publicField(this, "onevent");
      __publicField(this, "oneose");
      __publicField(this, "onclose");
      __publicField(this, "eoseTimeout");
      __publicField(this, "eoseTimeoutHandle");
      this.relay = relay;
      this.filters = filters;
      this.id = id;
      this.alreadyHaveEvent = params.alreadyHaveEvent;
      this.receivedEvent = params.receivedEvent;
      this.eoseTimeout = params.eoseTimeout || relay.baseEoseTimeout;
      this.oneose = params.oneose;
      this.onclose = params.onclose;
      this.onevent = params.onevent || ((event) => {
        console.warn(
          `onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
          event
        );
      });
    }
    fire() {
      this.relay.send('["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1));
      this.eoseTimeoutHandle = setTimeout(this.receivedEose.bind(this), this.eoseTimeout);
    }
    receivedEose() {
      var _a2;
      if (this.eosed)
        return;
      clearTimeout(this.eoseTimeoutHandle);
      this.eosed = true;
      (_a2 = this.oneose) == null ? void 0 : _a2.call(this);
    }
    close(reason = "closed by caller") {
      var _a2;
      if (!this.closed && this.relay.connected) {
        this.relay.send('["CLOSE",' + JSON.stringify(this.id) + "]");
        this.closed = true;
      }
      this.relay.openSubs.delete(this.id);
      (_a2 = this.onclose) == null ? void 0 : _a2.call(this, reason);
    }
  };
  var _WebSocket;
  try {
    _WebSocket = WebSocket;
  } catch {
  }
  var Relay = class extends AbstractRelay {
    constructor(url) {
      super(url, { verifyEvent, websocketImplementation: _WebSocket });
    }
    static async connect(url) {
      const relay = new Relay(url);
      await relay.connect();
      return relay;
    }
  };
  var _fetch;
  try {
    _fetch = fetch;
  } catch {
  }
  async function fetchRelayInformation$1(url) {
    return await (await fetch(url.replace("ws://", "http://").replace("wss://", "https://"), {
      headers: { Accept: "application/nostr+json" }
    })).json();
  }
  var verifiedSymbol = Symbol("verified");
  var isRecord = (obj) => obj instanceof Object;
  function validateEvent(event) {
    if (!isRecord(event))
      return false;
    if (typeof event.kind !== "number")
      return false;
    if (typeof event.content !== "string")
      return false;
    if (typeof event.created_at !== "number")
      return false;
    if (typeof event.pubkey !== "string")
      return false;
    if (!event.pubkey.match(/^[a-f0-9]{64}$/))
      return false;
    if (!Array.isArray(event.tags))
      return false;
    for (let i2 = 0; i2 < event.tags.length; i2++) {
      let tag = event.tags[i2];
      if (!Array.isArray(tag))
        return false;
      for (let j = 0; j < tag.length; j++) {
        if (typeof tag[j] === "object")
          return false;
      }
    }
    return true;
  }
  new TextDecoder("utf-8");
  var utf8Encoder = new TextEncoder();
  var JS = class {
    generateSecretKey() {
      return schnorr.utils.randomPrivateKey();
    }
    getPublicKey(secretKey) {
      return bytesToHex(schnorr.getPublicKey(secretKey));
    }
    finalizeEvent(t, secretKey) {
      const event = t;
      event.pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      event.id = getEventHash(event);
      event.sig = bytesToHex(schnorr.sign(getEventHash(event), secretKey));
      event[verifiedSymbol] = true;
      return event;
    }
    verifyEvent(event) {
      if (typeof event[verifiedSymbol] === "boolean")
        return event[verifiedSymbol];
      const hash2 = getEventHash(event);
      if (hash2 !== event.id) {
        event[verifiedSymbol] = false;
        return false;
      }
      try {
        const valid = schnorr.verify(event.sig, hash2, event.pubkey);
        event[verifiedSymbol] = valid;
        return valid;
      } catch (err) {
        event[verifiedSymbol] = false;
        return false;
      }
    }
  };
  function serializeEvent(evt) {
    if (!validateEvent(evt))
      throw new Error("can't serialize event with wrong or missing properties");
    return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
  }
  function getEventHash(event) {
    let eventHash = sha256(utf8Encoder.encode(serializeEvent(event)));
    return bytesToHex(eventHash);
  }
  var i = new JS();
  i.generateSecretKey;
  i.getPublicKey;
  i.finalizeEvent;
  i.verifyEvent;
  function getPow(hex2) {
    let count = 0;
    for (let i2 = 0; i2 < hex2.length; i2++) {
      const nibble = parseInt(hex2[i2], 16);
      if (nibble === 0) {
        count += 4;
      } else {
        count += Math.clz32(nibble) - 28;
        break;
      }
    }
    return count;
  }
  function minePow(unsigned, difficulty) {
    let count = 0;
    const event = unsigned;
    const tag = ["nonce", count.toString(), difficulty.toString()];
    event.tags.push(tag);
    while (true) {
      const now = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
      if (now !== event.created_at) {
        count = 0;
        event.created_at = now;
      }
      tag[1] = (++count).toString();
      event.id = getEventHash(event);
      if (getPow(event.id) >= difficulty) {
        break;
      }
    }
    return event;
  }
  const TIMEOUT = 7e3;
  const timeLimit = async (fn, timeout = TIMEOUT) => {
    let timer;
    try {
      timer = setTimeout(() => {
        throw new Error("Timelimit exceeded");
      }, timeout);
      return await fn();
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };
  const publishOnRelay = async (relayUrl, event) => {
    let relay = pool.relays.get(relayUrl);
    if (!relay) {
      relay = await Relay.connect(relayUrl);
    }
    await relay.publish(event);
  };
  const publishConcurrently = async (event, relays) => {
    const results = await Promise.allSettled(relays.map(
      async (relayUrl) => timeLimit(async () => await publishOnRelay(relayUrl, event))
    ));
    let ok = 0;
    const failures = [];
    for (let i2 = 0; i2 < results.length; i2++) {
      if (results[i2].status === "fulfilled") {
        ok += 1;
      } else if (results[i2]) {
        failures.push([relays[i2], results[i2]]);
      }
    }
    return [ok, failures];
  };
  const powIsOk = (id, powOrTags, minPow) => {
    if (minPow === 0) {
      return true;
    }
    let pow3 = 0;
    if (typeof powOrTags === "number") {
      pow3 = powOrTags;
    } else if (typeof powOrTags === "object") {
      const nonce = powOrTags.find((t) => t.length > 2 && t[0] === "nonce");
      pow3 = nonce && +nonce[2] || 0;
    }
    return pow3 >= minPow && getPow(id) >= minPow;
  };
  const supportedReadRelay = (info) => {
    if (!info) {
      return true;
    }
    const languages = store.languages;
    if (languages.length > 0 && info.language_tags && info.language_tags.length > 0) {
      if (languages.filter((lang) => info.language_tags.includes(lang)).length !== languages.length) {
        return false;
      }
    }
    return true;
  };
  const supportedWriteRelay = (event, info, maxWritePow) => {
    if (!info)
      return true;
    if (!supportedReadRelay(info))
      return false;
    const retention = info.retention;
    if (retention) {
      const eventKind = event ? event.kind : 1;
      const allowed = retention.filter((r) => {
        const disallowed = r.time && r.time === 0 || r.count && r.count === 0;
        const kindMatches = r.kinds.includes(eventKind);
        const kindRangeMatches = r.kinds.filter((r2) => Array.isArray(r2)).map((r2) => r2).map((kindRange) => kindRange.length == 2 && eventKind >= kindRange[0] && eventKind <= kindRange[1]).length > 0;
        return disallowed && (kindMatches || kindRangeMatches);
      }).length === 0;
      if (!allowed) {
        return false;
      }
    }
    const limitation = info.limitation;
    if (limitation) {
      if (limitation.auth_required && limitation.auth_required)
        return false;
      if (limitation.payment_required && limitation.payment_required)
        return false;
      if (limitation.min_pow_difficulty && (maxWritePow && maxWritePow < limitation.min_pow_difficulty || event && !powIsOk(event.id, event.tags, limitation.min_pow_difficulty)))
        return false;
      if (limitation.max_content_length && event && event.content.length > limitation.max_content_length)
        return false;
      if (limitation.max_message_length && event && ('["EVENT",' + JSON.stringify(event) + "]").length > limitation.max_message_length)
        return false;
    }
    return true;
  };
  const publishEvent = async (event) => {
    if (store.onPublish && !await store.onPublish(event.id, event.kind, event.content)) {
      return [0, 0];
    }
    const writeRelays = store.writeRelays;
    const relayInfos = Object.fromEntries((await findAll("relayInfos")).map((r) => [r.name, r]));
    const supportedWriteRelays = writeRelays.filter((r) => {
      const relayInfo = relayInfos[r];
      return !relayInfo || supportedWriteRelay(event, relayInfo.info);
    });
    const startTime = Date.now();
    const [ok, failures] = await publishConcurrently(event, supportedWriteRelays);
    const deltaTime = Date.now() - startTime;
    const unsupported = writeRelays.length - supportedWriteRelays.length;
    console.log(`[zapthreads] publish to ${supportedWriteRelays} ok=${ok} failed=${failures.length} unsupported=${unsupported} took ${deltaTime} ms`);
    failures.length > 0 && console.log(failures);
    return [ok, failures.length];
  };
  const fetchRelayInformation = async (relay) => await timeLimit(async () => await fetchRelayInformation$1(relay));
  const sign = async (unsignedEvent, signer) => {
    const pow3 = store.writePowDifficulty;
    let event;
    if (pow3 > 0) {
      const eventWithPow = minePow(unsignedEvent, pow3);
      const signature = await signer.signEvent(eventWithPow);
      event = { ...eventWithPow, ...signature };
    } else {
      const id = getEventHash$2(unsignedEvent);
      const signature = await signer.signEvent(unsignedEvent);
      event = { id, ...unsignedEvent, ...signature };
    }
    console.log(JSON.stringify(event, null, 2));
    return event;
  };
  const signAndPublishEvent = async (unsignedEvent, signer) => {
    const event = await sign(unsignedEvent, signer);
    const [ok, failures] = await publishEvent(event);
    return [ok, failures, event];
  };
  const nest = (events, parent) => {
    let nestedEvents = events.map((e) => ({ ...e, children: [] }));
    const currentLevelEvents = new Set(nestedEvents.filter((e) => {
      if (parent) {
        const belongsToLevel = parent.id === (e.re || e.ro);
        if (belongsToLevel) {
          e.parent = parent;
        }
        return belongsToLevel;
      }
      return !nestedEvents.find((e2) => e2.id === (e.re || e.ro));
    }));
    nestedEvents = nestedEvents.filter((e) => !currentLevelEvents.has(e));
    for (let e of currentLevelEvents) {
      e.children.push(...nest(nestedEvents, e));
    }
    return [...currentLevelEvents];
  };
  var createAutofocus = (ref) => {
    createEffect(() => {
      const el = ref();
      el && setTimeout(() => el.focus());
    });
  };
  new TextDecoder("utf-8");
  new TextEncoder();
  function normalizeURL(url) {
    if (url.indexOf("://") === -1)
      url = "wss://" + url;
    let p = new URL(url);
    p.pathname = p.pathname.replace(/\/+/g, "/");
    if (p.pathname.endsWith("/"))
      p.pathname = p.pathname.slice(0, -1);
    if (p.port === "80" && p.protocol === "ws:" || p.port === "443" && p.protocol === "wss:")
      p.port = "";
    p.searchParams.sort();
    p.hash = "";
    return p.toString();
  }
  var _tmpl$$2 = /* @__PURE__ */ template(`<div class=ztr-comment-info-picture><img>`), _tmpl$2$2 = /* @__PURE__ */ template(`<div class=ztr-reply-form><textarea></textarea><div class=ztr-reply-controls>`), _tmpl$3$2 = /* @__PURE__ */ template(`<span> Comment is limited to <!> characters; you entered <!>.`), _tmpl$4$2 = /* @__PURE__ */ template(`<span>Publishing is disabled`), _tmpl$5$2 = /* @__PURE__ */ template(`<span class=ztr-reply-error>Error: `), _tmpl$6$1 = /* @__PURE__ */ template(`<svg class=ztr-spinner viewBox="0 0 50 50"><circle class=path cx=25 cy=25 r=20 fill=none stroke-width=5>`), _tmpl$7$1 = /* @__PURE__ */ template(`<button class=ztr-reply-button>Reply as `), _tmpl$8$1 = /* @__PURE__ */ template(`<button class=ztr-reply-login-button><div style=display:inline-grid;vertical-align:middle></div>&nbsp;Login`), _tmpl$9$1 = /* @__PURE__ */ template(`<li class=ztr-comment-action-like><span> likes`), _tmpl$10$1 = /* @__PURE__ */ template(`<li class=ztr-comment-action-zap><span> sats`), _tmpl$11$1 = /* @__PURE__ */ template(`<div class=ztr-comment-new><div class=ztr-comment-body><ul class=ztr-comment-actions>`);
  const ReplyEditor = (props) => {
    const [comment, setComment] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [loggedInUser, setLoggedInUser] = createSignal();
    const [errorMessage, setErrorMessage] = createSignal("");
    const anchor = () => store.anchor;
    const profiles = store.profiles;
    const readRelays = () => store.readRelays;
    const writeRelays = () => store.writeRelays;
    const login = async () => {
      if (store.onLogin) {
        await store.onLogin();
        return;
      }
      if (!window.nostr) {
        onError("Error: No NIP-07 extension!");
        return;
      }
      const pk = await window.nostr.getPublicKey();
      signersStore.internal = {
        pk,
        signEvent: async (event) => window.nostr.signEvent(event)
      };
      setErrorMessage("");
      signersStore.active = signersStore.internal;
    };
    createEffect(async () => {
      if (signersStore.active) {
        const pk = signersStore.active.pk;
        let profile = profiles().find((p) => p.pk === pk);
        if (!profile) {
          profile = {
            pk,
            l: 0,
            ts: 0
          };
          await save("profiles", profile);
        }
        setLoggedInUser(profile);
        updateProfiles([pk], readRelays(), profiles());
      } else {
        setLoggedInUser();
      }
    });
    const onSuccess = async (event, notice) => {
      var _a2;
      setLoading(false);
      setComment("");
      setErrorMessage(notice ?? "");
      await save("events", eventToNoteEvent(event), {
        immediate: true
      });
      (_a2 = props.onDone) == null ? void 0 : _a2.call(void 0);
    };
    const onError = (message) => {
      setLoading(false);
      setErrorMessage(`Error: ${message}`);
    };
    const publish = async (profile) => {
      var _a2;
      let signer;
      if (profile) {
        signer = signersStore.active;
      } else {
        return;
      }
      if (store.onLogin && await store.onLogin() && (signer == null ? void 0 : signer.pk) !== ((_a2 = signersStore.active) == null ? void 0 : _a2.pk)) {
        console.log("current user has changed");
        return;
      }
      if (!(signer == null ? void 0 : signer.signEvent)) {
        onError("Error: User has no signer!");
        return;
      }
      const content = comment().trim();
      if (!content)
        return;
      const unsignedEvent = {
        kind: 1,
        created_at: currentTime(),
        content,
        pubkey: signer.pk,
        tags: generateTags(content)
      };
      if (store.anchorAuthor !== unsignedEvent.pubkey) {
        unsignedEvent.tags.push(["p", store.anchorAuthor]);
      }
      if (store.externalAuthor) {
        try {
          const pubkey = decode$2(store.externalAuthor).data;
          unsignedEvent.tags.push(["p", pubkey]);
        } catch (_) {
        }
      }
      if (props.replyTo) {
        const replyEvent = await find("events", IDBKeyRange.only(props.replyTo));
        if (replyEvent) {
          console.log("publishing reply");
          unsignedEvent.tags.push(["e", replyEvent.ro, "", "root"]);
          if (replyEvent.pk !== unsignedEvent.pubkey) {
            unsignedEvent.tags.push(["p", replyEvent.pk]);
          }
        }
        unsignedEvent.tags.push(["e", props.replyTo, "", "reply"]);
      } else {
        const rootEventId = store.version || store.rootEventIds[0];
        if (rootEventId) {
          unsignedEvent.tags.push(["e", rootEventId, "", "root"]);
        } else if (anchor().type === "http") {
          const url = normalizeURL(anchor().value);
          const unsignedRootEvent = {
            pubkey: signer.pk,
            created_at: currentTime(),
            kind: 8812,
            tags: [["r", url]],
            content: `Comments on ${url} ↴`
          };
          const rootEvent = await sign(unsignedRootEvent, signer);
          save("events", eventToNoteEvent(rootEvent));
          if (store.disableFeatures.includes("publish")) {
            console.log("Publishing root event disabled", rootEvent);
          } else {
            console.log("publishing root event");
            publishEvent(rootEvent);
          }
          store.filter = {
            "#e": [rootEvent.id]
          };
          unsignedEvent.tags.push(["e", rootEvent.id, "", "root"]);
        }
      }
      if (anchor().type === "naddr") {
        unsignedEvent.tags.push(["a", anchor().value, "", "root"]);
      }
      setLoading(true);
      if (store.disableFeatures.includes("publish")) {
        const event = await sign(unsignedEvent, signer);
        setTimeout(() => onSuccess(event), 1e3);
      } else {
        const [ok, failures, event] = await signAndPublishEvent(unsignedEvent, signer);
        if (ok === 0) {
          onError("Error: Your comment was not published to any relay");
        } else {
          const msg = `Published to ${ok}/${writeRelays().length} relays (see console for more info)`;
          const notice = failures > 0 ? msg : void 0;
          onSuccess(event, notice);
        }
      }
    };
    const autofocus = props.replyTo !== void 0;
    let ref;
    createAutofocus(() => autofocus && ref);
    const maxCommentLength = () => store.maxCommentLength;
    const tooLong = () => comment().length > maxCommentLength();
    return (() => {
      var _el$ = _tmpl$2$2(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
      _el$2.$$input = (e) => setComment(e.target.value);
      var _ref$ = ref;
      typeof _ref$ === "function" ? use(_ref$, _el$2) : ref = _el$2;
      _el$2.autofocus = autofocus;
      insert(_el$, (() => {
        var _c$ = createMemo(() => comment().length > 0.98 * maxCommentLength());
        return () => _c$() && (() => {
          var _el$6 = _tmpl$3$2(), _el$7 = _el$6.firstChild, _el$10 = _el$7.nextSibling, _el$8 = _el$10.nextSibling, _el$11 = _el$8.nextSibling;
          _el$11.nextSibling;
          insert(_el$6, warningSvg, _el$7);
          insert(_el$6, maxCommentLength, _el$10);
          insert(_el$6, () => comment().length, _el$11);
          createRenderEffect(() => _el$6.classList.toggle("ztr-reply-error", !!tooLong()));
          return _el$6;
        })();
      })(), _el$3);
      insert(_el$3, (() => {
        var _c$2 = createMemo(() => !!store.disableFeatures.includes("publish"));
        return () => _c$2() && _tmpl$4$2();
      })(), null);
      insert(_el$3, (() => {
        var _c$3 = createMemo(() => !!errorMessage());
        return () => _c$3() && (() => {
          var _el$13 = _tmpl$5$2();
          _el$13.firstChild;
          insert(_el$13, errorMessage, null);
          return _el$13;
        })();
      })(), null);
      insert(_el$3, createComponent(Show, {
        get when() {
          return !loading();
        },
        get fallback() {
          return _tmpl$6$1();
        },
        get children() {
          var _el$4 = _tmpl$$2(), _el$5 = _el$4.firstChild;
          createRenderEffect(() => {
            var _a2;
            return setAttribute(_el$5, "src", ((_a2 = loggedInUser()) == null ? void 0 : _a2.i) || defaultPicture);
          });
          return _el$4;
        }
      }), null);
      insert(_el$3, (() => {
        var _c$4 = createMemo(() => !!loggedInUser());
        return () => _c$4() && (() => {
          var _el$16 = _tmpl$7$1();
          _el$16.firstChild;
          _el$16.$$click = () => publish(loggedInUser());
          insert(_el$16, () => loggedInUser().n || shortenEncodedId(npubEncode(loggedInUser().pk)), null);
          createRenderEffect(() => _el$16.disabled = loading() || tooLong());
          return _el$16;
        })();
      })(), null);
      insert(_el$3, (() => {
        var _c$5 = createMemo(() => !!!loggedInUser());
        return () => _c$5() && (() => {
          var _el$18 = _tmpl$8$1(), _el$19 = _el$18.firstChild;
          _el$18.$$click = () => login();
          insert(_el$19, nostrSvg);
          return _el$18;
        })();
      })(), null);
      createRenderEffect((_p$) => {
        var _v$ = loading(), _v$2 = store.replyPlaceholder || "Add your comment...", _v$3 = !!tooLong();
        _v$ !== _p$.e && (_el$2.disabled = _p$.e = _v$);
        _v$2 !== _p$.t && setAttribute(_el$2, "placeholder", _p$.t = _v$2);
        _v$3 !== _p$.a && _el$2.classList.toggle("too-long", _p$.a = _v$3);
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0
      });
      createRenderEffect(() => _el$2.value = comment());
      return _el$;
    })();
  };
  const RootComment = () => {
    const anchor = () => store.anchor;
    const zapsAggregate = watch(() => ["aggregates", IDBKeyRange.only([anchor().value, 9735])]);
    const likesAggregate = watch(() => ["aggregates", IDBKeyRange.only([anchor().value, 7])]);
    const zapCount = () => {
      var _a2;
      return ((_a2 = zapsAggregate()) == null ? void 0 : _a2.sum) ?? 0;
    };
    const likeCount = () => {
      var _a2;
      return ((_a2 = likesAggregate()) == null ? void 0 : _a2.ids.length) ?? 0;
    };
    return (() => {
      var _el$20 = _tmpl$11$1(), _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild;
      insert(_el$22, createComponent(Show, {
        get when() {
          return !store.disableFeatures.includes("likes");
        },
        get children() {
          var _el$23 = _tmpl$9$1(), _el$24 = _el$23.firstChild, _el$25 = _el$24.firstChild;
          insert(_el$23, likeSvg, _el$24);
          insert(_el$24, likeCount, _el$25);
          return _el$23;
        }
      }), null);
      insert(_el$22, createComponent(Show, {
        get when() {
          return !store.disableFeatures.includes("zaps");
        },
        get children() {
          var _el$26 = _tmpl$10$1(), _el$27 = _el$26.firstChild, _el$28 = _el$27.firstChild;
          insert(_el$26, lightningSvg, _el$27);
          insert(_el$27, () => satsAbbrev(zapCount()), _el$28);
          return _el$26;
        }
      }), null);
      insert(_el$21, createComponent(ReplyEditor, {}), null);
      return _el$20;
    })();
  };
  delegateEvents(["input", "click"]);
  var _tmpl$$1 = /* @__PURE__ */ template(`<div class=ztr-thread>`), _tmpl$2$1 = /* @__PURE__ */ template(`<li class=ztr-comment-action-reply><span>`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class=ztr-comment><div class=ztr-comment-body><div class=ztr-comment-info-wrapper><div class=ztr-comment-info><div class=ztr-comment-info-picture><img></div><ul class=ztr-comment-info-items><li class=ztr-comment-info-author><a target=_blank></a><span style=white-space:nowrap;><a target=_blank style=font-weight:400><small>ed </small></a></span></li></ul></div></div><div class=ztr-comment-text></div><ul class=ztr-comment-actions></ul></div><div class=ztr-comment-replies><div class=ztr-comment-replies-info-actions>`), _tmpl$4$1 = /* @__PURE__ */ template(`<div class=ztr-comment-text><p class=warning><span>This is a <!> that referenced this article in <a>another thread`), _tmpl$5$1 = /* @__PURE__ */ template(`<div class=ztr-comment-text><p class=warning><span>Article contents may have changed since this <!> was made`), _tmpl$6 = /* @__PURE__ */ template(`<div class=ztr-comment-text><p class=warning><span>Article contents changed since this <!> was made`), _tmpl$7 = /* @__PURE__ */ template(`<div class=ztr-comment-expand><span>`), _tmpl$8 = /* @__PURE__ */ template(`<li class=ztr-comment-action-upvote>`), _tmpl$9 = /* @__PURE__ */ template(`<li class=ztr-comment-action-votes><span>`), _tmpl$10 = /* @__PURE__ */ template(`<li class=ztr-comment-action-downvote>`), _tmpl$11 = /* @__PURE__ */ template(`<ul class=ztr-comment-replies-info-items><li><span>`), _tmpl$12 = /* @__PURE__ */ template(`<li> repl`), _tmpl$14 = /* @__PURE__ */ template(`<svg width=40 height=46 viewBox="0 0 525 600"fill=none xmlns=http://www.w3.org/2000/svg><path d="M442.711 254.675C454.209 334.323 371.764 351.177 324.332 349.703C321.286 349.608 318.416 351.091 316.617 353.55C311.71 360.258 303.867 368.932 297.812 368.932C291.012 368.932 284.892 382.009 282.101 390.146C281.808 391 282.648 391.788 283.507 391.509C358.626 367.118 388.103 358.752 400.801 361.103C411.052 363.001 430.226 397.321 438.532 414.244C417.886 415.43 411.005 396.926 406.259 393.604C402.462 390.947 401.038 403.094 400.801 409.499C396.292 407.127 390.597 403.806 390.122 393.604C389.648 383.403 384.427 386.013 380.393 386.487C376.359 386.962 314.423 406.89 305.169 409.499C295.914 412.109 285.235 415.667 276.455 421.836C261.743 428.953 252.251 423.971 249.64 411.872C247.552 402.192 261.11 372.411 268.15 358.731C259.449 361.973 241.382 368.552 238.724 368.932C236.147 369.3 203.454 394.539 185.97 408.253C184.95 409.053 184.294 410.225 184.059 411.499C181.262 426.698 172.334 430.952 156.856 438.917C144.4 445.326 100.9 512.174 78.5318 548.261C76.9851 550.756 74.7151 552.673 72.2776 554.31C58.0697 563.847 43.5996 588.121 37.7308 600C29.3778 575.897 40.262 555.162 46.7482 547.808C43.9006 545.341 37.3353 546.78 34.4086 547.808C42.4768 520.051 70.7156 520.051 69.7664 520.051C74.987 515.544 136.211 428.004 137.634 423.971C139.047 419.97 136.723 401.262 167.494 391.005C167.982 390.842 168.467 390.619 168.9 390.34C192.873 374.933 210.857 350.094 216.893 339.514C184.887 337.314 148.236 319.47 129.072 308.008C124.941 305.538 120.56 303.387 115.777 302.846C89.5384 299.876 63.2668 316.661 52.6808 326.229C48.3144 320.156 53.2345 302.506 56.2403 294.44C45.6092 292.921 29.979 308.357 23.4928 316.265C16.4687 305.258 22.6227 285.583 26.5777 277.121C12.5295 277.501 3.00581 283.922 0 287.085C11.6277 200.494 100.569 225.677 101.565 226.827C96.8187 221.893 97.2142 215.44 98.0052 212.83C151.872 214.254 177.026 205.239 192.925 195.986C318.22 126.002 372.206 168.942 392.139 179.736C412.073 190.53 448.261 194.919 473.296 184.955C503.196 171.432 498.695 136.577 492.636 123.274C485.992 108.683 448.498 88.5179 435.209 63.0154C421.921 37.5129 433.5 6.50012 448.895 2.17754C463.562 -1.94096 474.037 2.85041 482.076 10.1115C487.436 14.9524 502.484 18.4148 508.773 20.6685C515.061 22.9223 525.502 25.8877 524.909 27.667C524.316 29.4463 514.249 29.2088 512.688 29.2088C509.485 29.2088 505.688 29.6833 509.485 31.4626C513.937 33.2682 520.657 35.8924 523.875 37.6198C524.294 37.8443 524.207 38.4293 523.749 38.5526C501.912 44.4295 482.414 32.3029 467.957 46.2898C453.244 60.524 484.568 71.4369 500.704 88.5179C516.841 105.599 533.452 126.001 520.163 172.5C509.875 208.497 466.758 239.103 444.486 251.075C443.205 251.764 442.503 253.235 442.711 254.675Z"fill=#2B2B2B>`), _tmpl$15 = /* @__PURE__ */ template(`<svg viewBox="0 -6 60 60"xmlns=http://www.w3.org/2000/svg><path d="M 12.6030 50.4905 C 13.3758 50.4905 13.9307 50.1140 14.8621 49.2421 L 20.6483 43.8720 C 19.5188 42.9803 18.6073 41.5733 18.6073 38.3433 L 18.6073 25.2052 C 18.6073 19.1217 22.3129 15.5152 28.3766 15.5152 L 42.2479 15.5152 L 42.2281 14.7622 C 41.9306 10.6999 39.2557 8.0643 34.7177 8.0643 L 7.5301 8.0643 C 2.9922 8.0643 0 10.7791 0 15.4954 L 0 34.9548 C 0 39.6710 2.9922 42.7028 7.5301 42.7028 L 10.8195 42.7028 L 10.8195 48.4693 C 10.8195 49.6979 11.4735 50.4905 12.6030 50.4905 Z M 44.6058 53.2450 C 45.7353 53.2450 46.3895 52.4325 46.3895 51.2237 L 46.3895 45.4374 L 48.4702 45.4374 C 53.0078 45.4374 56 42.4056 56 37.7092 L 56 25.6610 C 56 20.9250 53.0078 18.2300 48.4702 18.2300 L 28.8522 18.2300 C 24.1161 18.2300 21.3221 20.9250 21.3221 25.6610 L 21.3221 37.7092 C 21.3221 42.4056 24.1161 45.4374 28.8522 45.4374 L 35.1735 45.4374 L 42.3470 51.9767 C 43.2784 52.8487 43.8331 53.2450 44.6058 53.2450 Z">`), _tmpl$16 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="-120 -80 528 588"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z">`), _tmpl$17 = /* @__PURE__ */ template(`<svg viewBox="0 -16 180 180"xmlns=http://www.w3.org/2000/svg><path d="M60.732 29.7C41.107 29.7 22 39.7 22 67.41c0 27.29 45.274 67.29 74 94.89 28.744-27.6 74-67.6 74-94.89 0-27.71-19.092-37.71-38.695-37.71C116 29.7 104.325 41.575 96 54.066 87.638 41.516 76 29.7 60.732 29.7z">`), _tmpl$18 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 512 512"><path d="M323.8 34.8c-38.2-10.9-78.1 11.2-89 49.4l-5.7 20c-3.7 13-10.4 25-19.5 35l-51.3 56.4c-8.9 9.8-8.2 25 1.6 33.9s25 8.2 33.9-1.6l51.3-56.4c14.1-15.5 24.4-34 30.1-54.1l5.7-20c3.6-12.7 16.9-20.1 29.7-16.5s20.1 16.9 16.5 29.7l-5.7 20c-5.7 19.9-14.7 38.7-26.6 55.5c-5.2 7.3-5.8 16.9-1.7 24.9s12.3 13 21.3 13L448 224c8.8 0 16 7.2 16 16c0 6.8-4.3 12.7-10.4 15c-7.4 2.8-13 9-14.9 16.7s.1 15.8 5.3 21.7c2.5 2.8 4 6.5 4 10.6c0 7.8-5.6 14.3-13 15.7c-8.2 1.6-15.1 7.3-18 15.2s-1.6 16.7 3.6 23.3c2.1 2.7 3.4 6.1 3.4 9.9c0 6.7-4.2 12.6-10.2 14.9c-11.5 4.5-17.7 16.9-14.4 28.8c.4 1.3 .6 2.8 .6 4.3c0 8.8-7.2 16-16 16H286.5c-12.6 0-25-3.7-35.5-10.7l-61.7-41.1c-11-7.4-25.9-4.4-33.3 6.7s-4.4 25.9 6.7 33.3l61.7 41.1c18.4 12.3 40 18.8 62.1 18.8H384c34.7 0 62.9-27.6 64-62c14.6-11.7 24-29.7 24-50c0-4.5-.5-8.8-1.3-13c15.4-11.7 25.3-30.2 25.3-51c0-6.5-1-12.8-2.8-18.7C504.8 273.7 512 257.7 512 240c0-35.3-28.6-64-64-64l-92.3 0c4.7-10.4 8.7-21.2 11.8-32.2l5.7-20c10.9-38.2-11.2-78.1-49.4-89zM32 192c-17.7 0-32 14.3-32 32V448c0 17.7 14.3 32 32 32H96c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32H32z">`), _tmpl$19 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 512 512"><path d="M323.8 477.2c-38.2 10.9-78.1-11.2-89-49.4l-5.7-20c-3.7-13-10.4-25-19.5-35l-51.3-56.4c-8.9-9.8-8.2-25 1.6-33.9s25-8.2 33.9 1.6l51.3 56.4c14.1 15.5 24.4 34 30.1 54.1l5.7 20c3.6 12.7 16.9 20.1 29.7 16.5s20.1-16.9 16.5-29.7l-5.7-20c-5.7-19.9-14.7-38.7-26.6-55.5c-5.2-7.3-5.8-16.9-1.7-24.9s12.3-13 21.3-13L448 288c8.8 0 16-7.2 16-16c0-6.8-4.3-12.7-10.4-15c-7.4-2.8-13-9-14.9-16.7s.1-15.8 5.3-21.7c2.5-2.8 4-6.5 4-10.6c0-7.8-5.6-14.3-13-15.7c-8.2-1.6-15.1-7.3-18-15.2s-1.6-16.7 3.6-23.3c2.1-2.7 3.4-6.1 3.4-9.9c0-6.7-4.2-12.6-10.2-14.9c-11.5-4.5-17.7-16.9-14.4-28.8c.4-1.3 .6-2.8 .6-4.3c0-8.8-7.2-16-16-16H286.5c-12.6 0-25 3.7-35.5 10.7l-61.7 41.1c-11 7.4-25.9 4.4-33.3-6.7s-4.4-25.9 6.7-33.3l61.7-41.1c18.4-12.3 40-18.8 62.1-18.8H384c34.7 0 62.9 27.6 64 62c14.6 11.7 24 29.7 24 50c0 4.5-.5 8.8-1.3 13c15.4 11.7 25.3 30.2 25.3 51c0 6.5-1 12.8-2.8 18.7C504.8 238.3 512 254.3 512 272c0 35.3-28.6 64-64 64l-92.3 0c4.7 10.4 8.7 21.2 11.8 32.2l5.7 20c10.9 38.2-11.2 78.1-49.4 89zM32 384c-17.7 0-32-14.3-32-32V128c0-17.7 14.3-32 32-32H96c17.7 0 32 14.3 32 32V352c0 17.7-14.3 32-32 32H32z">`), _tmpl$20 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 512 512"><path d="M313.4 32.9c26 5.2 42.9 30.5 37.7 56.5l-2.3 11.4c-5.3 26.7-15.1 52.1-28.8 75.2H464c26.5 0 48 21.5 48 48c0 18.5-10.5 34.6-25.9 42.6C497 275.4 504 288.9 504 304c0 23.4-16.8 42.9-38.9 47.1c4.4 7.3 6.9 15.8 6.9 24.9c0 21.3-13.9 39.4-33.1 45.6c.7 3.3 1.1 6.8 1.1 10.4c0 26.5-21.5 48-48 48H294.5c-19 0-37.5-5.6-53.3-16.1l-38.5-25.7C176 420.4 160 390.4 160 358.3V320 272 247.1c0-29.2 13.3-56.7 36-75l7.4-5.9c26.5-21.2 44.6-51 51.2-84.2l2.3-11.4c5.2-26 30.5-42.9 56.5-37.7zM32 192H96c17.7 0 32 14.3 32 32V448c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32V224c0-17.7 14.3-32 32-32z">`), _tmpl$21 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 512 512"><path d="M313.4 479.1c26-5.2 42.9-30.5 37.7-56.5l-2.3-11.4c-5.3-26.7-15.1-52.1-28.8-75.2H464c26.5 0 48-21.5 48-48c0-18.5-10.5-34.6-25.9-42.6C497 236.6 504 223.1 504 208c0-23.4-16.8-42.9-38.9-47.1c4.4-7.3 6.9-15.8 6.9-24.9c0-21.3-13.9-39.4-33.1-45.6c.7-3.3 1.1-6.8 1.1-10.4c0-26.5-21.5-48-48-48H294.5c-19 0-37.5 5.6-53.3 16.1L202.7 73.8C176 91.6 160 121.6 160 153.7V192v48 24.9c0 29.2 13.3 56.7 36 75l7.4 5.9c26.5 21.2 44.6 51 51.2 84.2l2.3 11.4c5.2 26 30.5 42.9 56.5 37.7zM32 384H96c17.7 0 32-14.3 32-32V128c0-17.7-14.3-32-32-32H32C14.3 96 0 110.3 0 128V352c0 17.7 14.3 32 32 32z">`), _tmpl$23 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 448 512"><path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z">`), _tmpl$24 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 448 512"><path d="M201.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 205.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z">`), _tmpl$25 = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 512 512"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z">`);
  const Thread = (props) => {
    const anchor = () => store.anchor;
    const profiles = store.profiles;
    const MIN_AUTO_COLLAPSED_THREADS = 3;
    const MIN_AUTO_COLLAPSED_COMMENTS = 5;
    const bottomNestedEvents = () => props.bottomNestedEvents ? props.bottomNestedEvents() : [];
    const firstLevelComments = () => props.firstLevelComments && props.firstLevelComments() || 0;
    const userObservedComments = () => store.userObservedComments;
    return (() => {
      var _el$ = _tmpl$$1();
      insert(_el$, createComponent(Index, {
        get each() {
          return [...sortByDate(props.topNestedEvents()), ...bottomNestedEvents()];
        },
        children: (event) => {
          const [isOpen, setOpen] = createSignal(false);
          const isExpanded = () => store.messageExpanded.has(event().id);
          const setExpanded = (expanded) => {
            if (expanded) {
              store.messageExpanded.add(event().id);
            } else {
              store.messageExpanded.delete(event().id);
            }
          };
          const [overflowed, setOverflowed] = createSignal(false);
          const isRootEvent = !event().parent;
          const total = createMemo(() => totalChildren(event()));
          const shortCommentsSection = () => firstLevelComments() >= MIN_AUTO_COLLAPSED_THREADS || total() >= MIN_AUTO_COLLAPSED_COMMENTS;
          const [isThreadCollapsed, setThreadCollapsedInternal] = createSignal(store.threadCollapsed.get(event().id) || isRootEvent && userObservedComments() && shortCommentsSection());
          const setThreadCollapsed = (collapsed) => {
            setThreadCollapsedInternal(collapsed);
            store.threadCollapsed.set(event().id, collapsed);
          };
          createEffect(on([userObservedComments, shortCommentsSection], () => {
            const collapsed = store.threadCollapsed.get(event().id);
            if (collapsed !== void 0) {
              setThreadCollapsed(collapsed);
            } else if (isRootEvent && userObservedComments()) {
              setThreadCollapsed(shortCommentsSection());
            }
          }));
          const [votesCount, setVotesCount] = createSignal(0);
          const [hasVotes, setHasVotes] = createSignal(false);
          const [currentUserVote, setCurrentUserVote] = createSignal(0);
          const currentNoteVotes = () => props.votes().filter((r) => r.noteId === event().id);
          const currentNoteVotesDeduplicatedByPks = () => {
            const grouped = /* @__PURE__ */ new Map();
            currentNoteVotes().forEach((r) => {
              if (!grouped.has(r.pk)) {
                grouped.set(r.pk, []);
              }
              grouped.get(r.pk).push(r);
            });
            return [...grouped.values()].map((reactionEvents) => sortByDate(reactionEvents)[0]);
          };
          const getSigner = async () => {
            if (store.onLogin) {
              const acceptedLogin = await store.onLogin();
              if (!acceptedLogin) {
                return;
              }
            }
            if (!signersStore.active) {
              console.error("Error: active signer is not set!");
              return;
            }
            const signer = signersStore.active;
            if (!(signer == null ? void 0 : signer.signEvent)) {
              console.error("Error: User has no signer!");
              return;
            }
            return signer;
          };
          createEffect(() => {
            batch(() => {
              const votes = currentNoteVotesDeduplicatedByPks();
              setHasVotes(votes.length > 0);
              const newVoteCount = votes.map((r) => voteKind(r)).reduce((sum, i2) => sum + i2, 0);
              setVotesCount(newVoteCount);
              const signer = signersStore.active;
              const kind = signer && votes.filter((r) => r.pk === signer.pk).map((r) => voteKind(r))[0] || 0;
              setCurrentUserVote(kind);
            });
          });
          const toggleVote = async (reaction, note) => {
            const s = await getSigner();
            if (!s) {
              return;
            }
            const signer = s;
            const latestVote = currentUserVote();
            const newVote = latestVote === reaction ? 0 : reaction;
            const rootEventId = note.ro || store.version || store.rootEventIds[0];
            const publishVote = async () => {
              const tags = [];
              if (rootEventId) {
                tags.push(["e", rootEventId, "", "root"]);
              }
              await signAndPublishEvent({
                kind: 7,
                created_at: currentTime(),
                content: newVote === -1 ? "-" : "+",
                pubkey: signer.pk,
                tags: [...tags, ["e", note.id, "", "reply"], ["p", signer.pk]]
              }, signer);
            };
            const unpublishOutdatedEvents = async () => {
              const eids = sortByDate(currentNoteVotes().filter((r) => r.pk === signer.pk)).reverse().map((i2) => i2.eid);
              if (eids.length === 0) {
                return;
              }
              const sentRequest = await signAndPublishEvent({
                kind: 5,
                created_at: currentTime(),
                content: "",
                pubkey: signer.pk,
                tags: eids.map((eid) => ["e", eid])
              }, signer);
              if (sentRequest) {
                remove("reactions", eids);
              }
            };
            await unpublishOutdatedEvents();
            if ([-1, 1].includes(newVote)) {
              await publishVote();
            }
          };
          const MAX_LENGTH = 255;
          const [target, setTarget] = createSignal();
          const [profilePicture, setProfilePicture] = createSignal(defaultPicture);
          const pubkey = () => event().pk;
          const npub = () => npubEncode(pubkey());
          const profile = () => profiles().find((p) => p.pk === pubkey());
          createEffect(async () => {
            var _a2;
            setProfilePicture(((_a2 = profile()) == null ? void 0 : _a2.i) || defaultPicture);
          });
          let timer;
          const createdAt = () => timeAgo(event().ts * 1e3);
          const [createdTimeAgo, setCreatedTimeAgo] = createSignal();
          createEffect(() => {
            setCreatedTimeAgo(createdAt());
            timer = setInterval(() => {
              setCreatedTimeAgo(createdAt());
            }, 60 * 1e3);
          });
          const isAnchorMentioned = () => event().a === anchor().value && event().am;
          const action = () => event().k === 9802 ? "highlight" : isAnchorMentioned() ? "mention" : "comment";
          const isUnspecifiedVersion = () => (
            // if it does not have a parent or rootId
            !event().parent && !event().ro
          );
          const isMissingEvent = () => (
            // if it does not have a parent
            !event().parent && // does have a root but it's not in the rootEvents
            event().ro && !store.rootEventIds.includes(event().ro)
          );
          const isDifferentVersion = () => (
            // if it does not have a parent
            !event().parent && // does have a root in root events
            event().ro && store.rootEventIds.includes(event().ro) && store.version && store.version !== event().ro
          );
          onCleanup(() => {
            clearInterval(timer);
          });
          const parsedContent = createMemo(() => {
            const result = parseContent(event(), store, props.articles());
            if (!overflowed() && result.length > MAX_LENGTH) {
              setOverflowed(true);
            }
            return result;
          });
          return (() => {
            var _el$2 = _tmpl$3$1(), _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.firstChild, _el$8 = _el$6.nextSibling, _el$9 = _el$8.firstChild, _el$10 = _el$9.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$12.firstChild, _el$14 = _el$13.firstChild, _el$15 = _el$4.nextSibling, _el$16 = _el$15.nextSibling, _el$19 = _el$3.nextSibling, _el$20 = _el$19.firstChild;
            _el$7.addEventListener("error", () => setProfilePicture(defaultPicture));
            insert(_el$10, () => {
              var _a2;
              return ((_a2 = profile()) == null ? void 0 : _a2.n) || shortenEncodedId(npub());
            });
            insert(_el$13, action, _el$14);
            insert(_el$13, createdTimeAgo, null);
            insert(_el$3, (() => {
              var _c$ = createMemo(() => !!isMissingEvent());
              return () => _c$() && (() => {
                var _el$21 = _tmpl$4$1(), _el$22 = _el$21.firstChild, _el$23 = _el$22.firstChild, _el$24 = _el$23.firstChild, _el$27 = _el$24.nextSibling, _el$25 = _el$27.nextSibling, _el$26 = _el$25.nextSibling;
                insert(_el$22, warningSvg, _el$23);
                insert(_el$23, action, _el$27);
                createRenderEffect(() => setAttribute(_el$26, "href", store.urlPrefixes.note + noteEncode(event().ro)));
                return _el$21;
              })();
            })(), _el$15);
            insert(_el$3, (() => {
              var _c$2 = createMemo(() => !!isUnspecifiedVersion());
              return () => _c$2() && (() => {
                var _el$28 = _tmpl$5$1(), _el$29 = _el$28.firstChild, _el$30 = _el$29.firstChild, _el$31 = _el$30.firstChild, _el$33 = _el$31.nextSibling;
                _el$33.nextSibling;
                insert(_el$29, warningSvg, _el$30);
                insert(_el$30, action, _el$33);
                return _el$28;
              })();
            })(), _el$15);
            insert(_el$3, (() => {
              var _c$3 = createMemo(() => !!isDifferentVersion());
              return () => _c$3() && (() => {
                var _el$34 = _tmpl$6(), _el$35 = _el$34.firstChild, _el$36 = _el$35.firstChild, _el$37 = _el$36.firstChild, _el$39 = _el$37.nextSibling;
                _el$39.nextSibling;
                insert(_el$35, warningSvg, _el$36);
                insert(_el$36, action, _el$39);
                return _el$34;
              })();
            })(), _el$15);
            use(setTarget, _el$15);
            insert(_el$3, (() => {
              var _c$4 = createMemo(() => !!overflowed());
              return () => _c$4() && (() => {
                var _el$40 = _tmpl$7(), _el$41 = _el$40.firstChild;
                _el$40.$$click = () => setExpanded(!isExpanded());
                insert(_el$41, () => isExpanded() ? "Show less" : "Read more");
                return _el$40;
              })();
            })(), _el$16);
            insert(_el$16, () => createComponent(Show, {
              get when() {
                return !store.disableFeatures.includes("votes");
              },
              get children() {
                return [(() => {
                  var _el$42 = _tmpl$8();
                  _el$42.$$click = () => toggleVote(1, event());
                  insert(_el$42, (() => {
                    var _c$8 = createMemo(() => currentUserVote() === 1);
                    return () => _c$8() ? upvoteSelectedSvg() : upvoteSvg();
                  })());
                  createRenderEffect(() => _el$42.classList.toggle("selected", !!(currentUserVote() === 1)));
                  return _el$42;
                })(), (() => {
                  var _el$43 = _tmpl$9(), _el$44 = _el$43.firstChild;
                  insert(_el$44, (() => {
                    var _c$9 = createMemo(() => !!hasVotes());
                    return () => _c$9() ? votesCount() : "Vote";
                  })());
                  return _el$43;
                })(), (() => {
                  var _el$45 = _tmpl$10();
                  _el$45.$$click = () => toggleVote(-1, event());
                  insert(_el$45, (() => {
                    var _c$10 = createMemo(() => currentUserVote() === -1);
                    return () => _c$10() ? downvoteSelectedSvg() : downvoteSvg();
                  })());
                  createRenderEffect(() => _el$45.classList.toggle("selected", !!(currentUserVote() === -1)));
                  return _el$45;
                })()];
              }
            }), null);
            insert(_el$16, createComponent(Show, {
              get when() {
                return !store.disableFeatures.includes("reply");
              },
              get children() {
                var _el$17 = _tmpl$2$1(), _el$18 = _el$17.firstChild;
                _el$17.$$click = () => {
                  store.userStartedReadingComments = true;
                  setOpen(!isOpen());
                };
                insert(_el$17, replySvg, _el$18);
                insert(_el$18, () => isOpen() ? "Cancel" : "Reply");
                return _el$17;
              }
            }), null);
            insert(_el$3, (() => {
              var _c$5 = createMemo(() => !!isOpen());
              return () => _c$5() && createComponent(ReplyEditor, {
                get replyTo() {
                  return event().id;
                },
                onDone: () => {
                  setThreadCollapsed(false);
                  setOpen(false);
                }
              });
            })(), null);
            insert(_el$20, (() => {
              var _c$6 = createMemo(() => total() > 0);
              return () => _c$6() && (() => {
                var _el$46 = _tmpl$11(), _el$47 = _el$46.firstChild, _el$48 = _el$47.firstChild;
                _el$46.$$click = () => {
                  store.userStartedReadingComments = true;
                  setThreadCollapsed(!isThreadCollapsed());
                };
                insert(_el$48, (() => {
                  var _c$11 = createMemo(() => !!isThreadCollapsed());
                  return () => _c$11() ? upArrow() : downArrow();
                })());
                insert(_el$46, (() => {
                  var _c$12 = createMemo(() => !!isThreadCollapsed());
                  return () => _c$12() && (() => {
                    var _el$49 = _tmpl$12(), _el$50 = _el$49.firstChild;
                    insert(_el$49, total, _el$50);
                    insert(_el$49, () => total() > 1 ? "ies" : "y", null);
                    return _el$49;
                  })();
                })(), null);
                createRenderEffect(() => _el$46.classList.toggle("selected", !!isThreadCollapsed()));
                return _el$46;
              })();
            })());
            insert(_el$19, (() => {
              var _c$7 = createMemo(() => !!!isThreadCollapsed());
              return () => _c$7() && createComponent(Thread, {
                topNestedEvents: () => event().children,
                get articles() {
                  return props.articles;
                },
                get votes() {
                  return props.votes;
                }
              });
            })(), null);
            createRenderEffect((_p$) => {
              var _v$ = profilePicture(), _v$2 = store.urlPrefixes.npub + npub(), _v$3 = store.urlPrefixes.note + noteEncode(event().id), _v$4 = !!(overflowed() && !isExpanded()), _v$5 = !!(event().k == 9802), _v$6 = parsedContent();
              _v$ !== _p$.e && setAttribute(_el$7, "src", _p$.e = _v$);
              _v$2 !== _p$.t && setAttribute(_el$10, "href", _p$.t = _v$2);
              _v$3 !== _p$.a && setAttribute(_el$12, "href", _p$.a = _v$3);
              _v$4 !== _p$.o && _el$15.classList.toggle("ztr-comment-text-fade", _p$.o = _v$4);
              _v$5 !== _p$.i && _el$15.classList.toggle("highlight", _p$.i = _v$5);
              _v$6 !== _p$.n && (_el$15.innerHTML = _p$.n = _v$6);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0,
              o: void 0,
              i: void 0,
              n: void 0
            });
            return _el$2;
          })();
        }
      }));
      return _el$;
    })();
  };
  const nostrSvg = () => _tmpl$14();
  const replySvg = () => (() => {
    var _el$53 = _tmpl$15();
    setAttribute(_el$53, "width", svgWidth);
    setAttribute(_el$53, "height", svgWidth);
    return _el$53;
  })();
  const lightningSvg = () => (() => {
    var _el$54 = _tmpl$16();
    setAttribute(_el$54, "width", svgWidth);
    setAttribute(_el$54, "height", svgWidth);
    return _el$54;
  })();
  const likeSvg = () => (() => {
    var _el$55 = _tmpl$17();
    setAttribute(_el$55, "width", svgWidth);
    setAttribute(_el$55, "height", svgWidth);
    return _el$55;
  })();
  const upvoteSvg = () => _tmpl$18();
  const downvoteSvg = () => _tmpl$19();
  const upvoteSelectedSvg = () => _tmpl$20();
  const downvoteSelectedSvg = () => _tmpl$21();
  const upArrow = () => _tmpl$23();
  const downArrow = () => _tmpl$24();
  const warningSvg = () => (() => {
    var _el$63 = _tmpl$25();
    setAttribute(_el$63, "height", svgWidth);
    return _el$63;
  })();
  delegateEvents(["click"]);
  const { bech32, hex, utf8 } = lib;
  const DEFAULTNETWORK = {
    // default network is bitcoin
    bech32: "bc",
    pubKeyHash: 0,
    scriptHash: 5,
    validWitnessVersions: [0]
  };
  const TESTNETWORK = {
    bech32: "tb",
    pubKeyHash: 111,
    scriptHash: 196,
    validWitnessVersions: [0]
  };
  const SIGNETNETWORK = {
    bech32: "tbs",
    pubKeyHash: 111,
    scriptHash: 196,
    validWitnessVersions: [0]
  };
  const REGTESTNETWORK = {
    bech32: "bcrt",
    pubKeyHash: 111,
    scriptHash: 196,
    validWitnessVersions: [0]
  };
  const SIMNETWORK = {
    bech32: "sb",
    pubKeyHash: 63,
    scriptHash: 123,
    validWitnessVersions: [0]
  };
  const FEATUREBIT_ORDER = [
    "option_data_loss_protect",
    "initial_routing_sync",
    "option_upfront_shutdown_script",
    "gossip_queries",
    "var_onion_optin",
    "gossip_queries_ex",
    "option_static_remotekey",
    "payment_secret",
    "basic_mpp",
    "option_support_large_channel"
  ];
  const DIVISORS = {
    m: BigInt(1e3),
    u: BigInt(1e6),
    n: BigInt(1e9),
    p: BigInt(1e12)
  };
  const MAX_MILLISATS = BigInt("2100000000000000000");
  const MILLISATS_PER_BTC = BigInt(1e11);
  const TAGCODES = {
    payment_hash: 1,
    payment_secret: 16,
    description: 13,
    payee: 19,
    description_hash: 23,
    // commit to longer descriptions (used by lnurl-pay)
    expiry: 6,
    // default: 3600 (1 hour)
    min_final_cltv_expiry: 24,
    // default: 9
    fallback_address: 9,
    route_hint: 3,
    // for extra routing info (private etc.)
    feature_bits: 5,
    metadata: 27
  };
  const TAGNAMES = {};
  for (let i2 = 0, keys = Object.keys(TAGCODES); i2 < keys.length; i2++) {
    const currentName = keys[i2];
    const currentCode = TAGCODES[keys[i2]].toString();
    TAGNAMES[currentCode] = currentName;
  }
  const TAGPARSERS = {
    1: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
    // 256 bits
    16: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
    // 256 bits
    13: (words) => utf8.encode(bech32.fromWordsUnsafe(words)),
    // string variable length
    19: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
    // 264 bits
    23: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
    // 256 bits
    27: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
    // variable
    6: wordsToIntBE,
    // default: 3600 (1 hour)
    24: wordsToIntBE,
    // default: 9
    3: routingInfoParser,
    // for extra routing info (private etc.)
    5: featureBitsParser
    // keep feature bits as array of 5 bit words
  };
  function getUnknownParser(tagCode) {
    return (words) => ({
      tagCode: parseInt(tagCode),
      words: bech32.encode("unknown", words, Number.MAX_SAFE_INTEGER)
    });
  }
  function wordsToIntBE(words) {
    return words.reverse().reduce((total, item, index) => {
      return total + item * Math.pow(32, index);
    }, 0);
  }
  function routingInfoParser(words) {
    const routes = [];
    let pubkey, shortChannelId, feeBaseMSats, feeProportionalMillionths, cltvExpiryDelta;
    let routesBuffer = bech32.fromWordsUnsafe(words);
    while (routesBuffer.length > 0) {
      pubkey = hex.encode(routesBuffer.slice(0, 33));
      shortChannelId = hex.encode(routesBuffer.slice(33, 41));
      feeBaseMSats = parseInt(hex.encode(routesBuffer.slice(41, 45)), 16);
      feeProportionalMillionths = parseInt(
        hex.encode(routesBuffer.slice(45, 49)),
        16
      );
      cltvExpiryDelta = parseInt(hex.encode(routesBuffer.slice(49, 51)), 16);
      routesBuffer = routesBuffer.slice(51);
      routes.push({
        pubkey,
        short_channel_id: shortChannelId,
        fee_base_msat: feeBaseMSats,
        fee_proportional_millionths: feeProportionalMillionths,
        cltv_expiry_delta: cltvExpiryDelta
      });
    }
    return routes;
  }
  function featureBitsParser(words) {
    const bools = words.slice().reverse().map((word) => [
      !!(word & 1),
      !!(word & 2),
      !!(word & 4),
      !!(word & 8),
      !!(word & 16)
    ]).reduce((finalArr, itemArr) => finalArr.concat(itemArr), []);
    while (bools.length < FEATUREBIT_ORDER.length * 2) {
      bools.push(false);
    }
    const featureBits = {};
    FEATUREBIT_ORDER.forEach((featureName, index) => {
      let status;
      if (bools[index * 2]) {
        status = "required";
      } else if (bools[index * 2 + 1]) {
        status = "supported";
      } else {
        status = "unsupported";
      }
      featureBits[featureName] = status;
    });
    const extraBits = bools.slice(FEATUREBIT_ORDER.length * 2);
    featureBits.extra_bits = {
      start_bit: FEATUREBIT_ORDER.length * 2,
      bits: extraBits,
      has_required: extraBits.reduce(
        (result, bit, index) => index % 2 !== 0 ? result || false : result || bit,
        false
      )
    };
    return featureBits;
  }
  function hrpToMillisat(hrpString, outputString) {
    let divisor, value;
    if (hrpString.slice(-1).match(/^[munp]$/)) {
      divisor = hrpString.slice(-1);
      value = hrpString.slice(0, -1);
    } else if (hrpString.slice(-1).match(/^[^munp0-9]$/)) {
      throw new Error("Not a valid multiplier for the amount");
    } else {
      value = hrpString;
    }
    if (!value.match(/^\d+$/))
      throw new Error("Not a valid human readable amount");
    const valueBN = BigInt(value);
    const millisatoshisBN = divisor ? valueBN * MILLISATS_PER_BTC / DIVISORS[divisor] : valueBN * MILLISATS_PER_BTC;
    if (divisor === "p" && !(valueBN % BigInt(10) === BigInt(0)) || millisatoshisBN > MAX_MILLISATS) {
      throw new Error("Amount is outside of valid range");
    }
    return outputString ? millisatoshisBN.toString() : millisatoshisBN;
  }
  function decode(paymentRequest, network) {
    if (typeof paymentRequest !== "string")
      throw new Error("Lightning Payment Request must be string");
    if (paymentRequest.slice(0, 2).toLowerCase() !== "ln")
      throw new Error("Not a proper lightning payment request");
    const sections = [];
    const decoded = bech32.decode(paymentRequest, Number.MAX_SAFE_INTEGER);
    paymentRequest = paymentRequest.toLowerCase();
    const prefix = decoded.prefix;
    let words = decoded.words;
    let letters = paymentRequest.slice(prefix.length + 1);
    let sigWords = words.slice(-104);
    words = words.slice(0, -104);
    let prefixMatches = prefix.match(/^ln(\S+?)(\d*)([a-zA-Z]?)$/);
    if (prefixMatches && !prefixMatches[2])
      prefixMatches = prefix.match(/^ln(\S+)$/);
    if (!prefixMatches) {
      throw new Error("Not a proper lightning payment request");
    }
    sections.push({
      name: "lightning_network",
      letters: "ln"
    });
    const bech32Prefix = prefixMatches[1];
    let coinNetwork;
    if (!network) {
      switch (bech32Prefix) {
        case DEFAULTNETWORK.bech32:
          coinNetwork = DEFAULTNETWORK;
          break;
        case TESTNETWORK.bech32:
          coinNetwork = TESTNETWORK;
          break;
        case SIGNETNETWORK.bech32:
          coinNetwork = SIGNETNETWORK;
          break;
        case REGTESTNETWORK.bech32:
          coinNetwork = REGTESTNETWORK;
          break;
        case SIMNETWORK.bech32:
          coinNetwork = SIMNETWORK;
          break;
      }
    } else {
      if (network.bech32 === void 0 || network.pubKeyHash === void 0 || network.scriptHash === void 0 || !Array.isArray(network.validWitnessVersions))
        throw new Error("Invalid network");
      coinNetwork = network;
    }
    if (!coinNetwork || coinNetwork.bech32 !== bech32Prefix) {
      throw new Error("Unknown coin bech32 prefix");
    }
    sections.push({
      name: "coin_network",
      letters: bech32Prefix,
      value: coinNetwork
    });
    const value = prefixMatches[2];
    let millisatoshis;
    if (value) {
      const divisor = prefixMatches[3];
      millisatoshis = hrpToMillisat(value + divisor, true);
      sections.push({
        name: "amount",
        letters: prefixMatches[2] + prefixMatches[3],
        value: millisatoshis
      });
    } else {
      millisatoshis = null;
    }
    sections.push({
      name: "separator",
      letters: "1"
    });
    const timestamp = wordsToIntBE(words.slice(0, 7));
    words = words.slice(7);
    sections.push({
      name: "timestamp",
      letters: letters.slice(0, 7),
      value: timestamp
    });
    letters = letters.slice(7);
    let tagName, parser, tagLength, tagWords;
    while (words.length > 0) {
      const tagCode = words[0].toString();
      tagName = TAGNAMES[tagCode] || "unknown_tag";
      parser = TAGPARSERS[tagCode] || getUnknownParser(tagCode);
      words = words.slice(1);
      tagLength = wordsToIntBE(words.slice(0, 2));
      words = words.slice(2);
      tagWords = words.slice(0, tagLength);
      words = words.slice(tagLength);
      sections.push({
        name: tagName,
        tag: letters[0],
        letters: letters.slice(0, 1 + 2 + tagLength),
        value: parser(tagWords)
        // see: parsers for more comments
      });
      letters = letters.slice(1 + 2 + tagLength);
    }
    sections.push({
      name: "signature",
      letters: letters.slice(0, 104),
      value: hex.encode(bech32.fromWordsUnsafe(sigWords))
    });
    letters = letters.slice(104);
    sections.push({
      name: "checksum",
      letters
    });
    let result = {
      paymentRequest,
      sections,
      get expiry() {
        let exp = sections.find((s) => s.name === "expiry");
        if (exp)
          return getValue("timestamp") + exp.value;
      },
      get route_hints() {
        return sections.filter((s) => s.name === "route_hint").map((s) => s.value);
      }
    };
    for (let name in TAGCODES) {
      if (name === "route_hint") {
        continue;
      }
      Object.defineProperty(result, name, {
        get() {
          return getValue(name);
        }
      });
    }
    return result;
    function getValue(name) {
      let section = sections.find((s) => s.name === name);
      return section ? section.value : void 0;
    }
  }
  var bolt11 = {
    decode,
    hrpToMillisat
  };
  var _tmpl$ = /* @__PURE__ */ template(`<div id=ztr-root><style>`), _tmpl$2 = /* @__PURE__ */ template(`<div id=ztr-content>`), _tmpl$3 = /* @__PURE__ */ template(`<h1>Error!`), _tmpl$4 = /* @__PURE__ */ template(`<div class=ztr-comment-text><pre></pre><p>Only properly formed NIP-19 naddr, note and nevent encoded entities and URLs are supported.`), _tmpl$5 = /* @__PURE__ */ template(`<h2 id=ztr-title>`);
  const ZapThreads2 = (props) => {
    const minReadPow = () => +props.minReadPow;
    const maxWritePow = () => +props.maxWritePow;
    const updateWritePow = async () => {
      const readRelaysCanValidatePow = await Promise.all(store.readRelays.map(async (relayUrl) => {
        const relayInfo = await find("relayInfos", relayUrl);
        return relayInfo && relayInfo.info && relayInfo.info.limitation && relayInfo.info.limitation.min_pow_difficulty && relayInfo.info.supported_nips.includes(13) && relayInfo.info.limitation.min_pow_difficulty >= minReadPow();
      }));
      store.validateReadPow = readRelaysCanValidatePow.filter((i2) => !i2).length > 0;
      const writeRelaysPows = await Promise.all(store.writeRelays.map(async (relayUrl) => {
        var _a2, _b2;
        const relayInfo = await find("relayInfos", relayUrl);
        return ((_b2 = (_a2 = relayInfo == null ? void 0 : relayInfo.info) == null ? void 0 : _a2.limitation) == null ? void 0 : _b2.min_pow_difficulty) || 0;
      }));
      store.writePowDifficulty = Math.max(minReadPow(), ...writeRelaysPows);
    };
    createComputed(() => {
      store.anchor = (() => {
        const anchor2 = props.anchor.trim();
        try {
          if (anchor2.startsWith("http")) {
            const removeSlashes = !props.legacyUrl;
            return {
              type: "http",
              value: normalizeURL$2(anchor2, removeSlashes)
            };
          }
          const decoded = decode$2(anchor2);
          switch (decoded.type) {
            case "nevent":
              return {
                type: "note",
                value: decoded.data.id
              };
            case "note":
              return {
                type: "note",
                value: decoded.data
              };
            case "naddr":
              const d = decoded.data;
              return {
                type: "naddr",
                value: `${d.kind}:${d.pubkey}:${d.identifier}`
              };
          }
        } catch (e) {
          console.error(e);
          return {
            type: "error",
            value: `Malformed anchor: ${anchor2}`
          };
        }
      })();
      if ((props.author || "").startsWith("npub")) {
        store.externalAuthor = props.author;
      }
      store.disableFeatures = props.disable.split(",").map((e) => e.trim()).filter(isDisableType);
      store.urlPrefixes = parseUrlPrefixes(props.urls);
      store.replyPlaceholder = props.replyPlaceholder;
      store.languages = props.languages.split(",").map((e) => e.trim());
      store.maxCommentLength = +props.maxCommentLength || Infinity;
      store.writePowDifficulty = Math.max(store.writePowDifficulty, minReadPow());
    });
    const MAX_RELAYS = 32;
    const rawReadRelays = () => props.readRelays;
    const [trackResubscribe, tryResubscribe] = createTrigger();
    const WEEK = 7 * 24 * 60 * 60;
    const TEN_MINS = 10 * 60;
    const infoExpired = (now, relayInfo) => {
      const lastInfoUpdateAttemptAt = relayInfo && relayInfo.lastInfoUpdateAttemptAt;
      return !lastInfoUpdateAttemptAt || now > lastInfoUpdateAttemptAt + (relayInfo.info ? TEN_MINS : WEEK);
    };
    const updateRelayInfos = async () => {
      const now = currentTime();
      const expiredRelays = [];
      for (const relayUrl of /* @__PURE__ */ new Set([...store.readRelays, ...store.writeRelays])) {
        const relayInfo = await find("relayInfos", relayUrl);
        if (infoExpired(now, relayInfo)) {
          expiredRelays.push(relayUrl);
        }
      }
      if (expiredRelays.length === 0)
        return;
      console.log(`[zapthreads] updating relay infos for ${expiredRelays.length} relays`);
      await Promise.allSettled(expiredRelays.map(async (relayUrl) => {
        let info;
        try {
          const possibleInfo = await fetchRelayInformation(relayUrl);
          supportedReadRelay(possibleInfo);
          supportedWriteRelay(void 0, possibleInfo, void 0);
          info = possibleInfo;
        } catch (e) {
        }
        await save("relayInfos", {
          name: relayUrl,
          info,
          lastInfoUpdateAttemptAt: now
        });
      }));
      await updateWritePow();
    };
    const updateRelays = async () => {
      const now = currentTime();
      const rawRelays = signersStore.active && window.nostr ? await window.nostr.getRelays() : Object.fromEntries((props.readRelays || "").split(",").map((r) => [r, {
        read: true,
        write: true
      }]));
      const relays = Object.fromEntries(Object.entries(rawRelays).map(([relayUrl, options]) => [relayUrl.trim(), options]).filter(([relayUrl, options]) => relayUrl.length > 0).map(([relayUrl, options]) => [new URL(relayUrl).toString(), options]));
      const sortedRelays = Object.entries(relays).sort(([a, _a2], [b, _b2]) => a.localeCompare(b));
      const healthyRelays = [];
      for (const [relayUrl, options] of sortedRelays) {
        if (healthyRelays.length >= MAX_RELAYS)
          break;
        const relayInfo = await find("relayInfos", relayUrl);
        const probablySupported = infoExpired(now, relayInfo) || (!options.read || supportedReadRelay(relayInfo.info)) && (!options.write || supportedWriteRelay(void 0, relayInfo.info, maxWritePow()));
        if (probablySupported) {
          healthyRelays.push([relayUrl, options]);
        }
      }
      const readRelays2 = healthyRelays.filter(([relayUrl, options]) => options.read).map(([r, _]) => r);
      const writeRelays = healthyRelays.filter(([relayUrl, options]) => options.write).map(([r, _]) => r);
      store.writeRelays = writeRelays;
      if (JSON.stringify(store.readRelays) !== JSON.stringify(readRelays2)) {
        batch(() => {
          store.readRelays = readRelays2;
          tryResubscribe();
        });
      }
      await updateWritePow();
      console.log(`readRelays=${readRelays2} writeRelays=${writeRelays}`);
    };
    createEffect(on([rawReadRelays], updateRelays));
    const anchor = () => store.anchor;
    const readRelays = () => store.readRelays;
    const disableFeatures = () => store.disableFeatures;
    const requestedVersion = () => props.version;
    store.profiles = watchAll(() => ["profiles"]);
    const closeOnEose = () => disableFeatures().includes("watch");
    createComputed(on([anchor], () => {
      store.version = requestedVersion();
    }));
    createComputed(on([anchor, readRelays], async () => {
      if (anchor().type === "error")
        return;
      let filterForRemoteRootEvents;
      let localRootEvents;
      switch (anchor().type) {
        case "http":
          localRootEvents = await findAll("events", anchor().value, {
            index: "r"
          });
          store.rootEventIds = sortByDate(localRootEvents).map((e2) => e2.id);
          const rf = props.legacyUrl ? [anchor().value] : [anchor().value, `${anchor().value}/`];
          filterForRemoteRootEvents = {
            "#r": rf,
            kinds: [1, 8812]
          };
          break;
        case "note":
          const e = await find("events", IDBKeyRange.only(anchor().value));
          if (e) {
            localRootEvents = [e];
            store.rootEventIds = [e.id];
            store.anchorAuthor = e.pk;
            return;
          } else {
            localRootEvents = [];
            filterForRemoteRootEvents = {
              ids: [anchor().value]
            };
            break;
          }
        case "naddr":
          const [kind, pubkey, identifier] = anchor().value.split(":");
          localRootEvents = (await findAll("events", identifier, {
            index: "d"
          })).filter((e2) => e2.pk === pubkey);
          if (localRootEvents.length > 0) {
            store.rootEventIds = sortByDate(localRootEvents).map((e2) => e2.id);
            store.anchorAuthor = localRootEvents[0].pk;
          }
          filterForRemoteRootEvents = {
            authors: [pubkey],
            kinds: [parseInt(kind)],
            "#d": [identifier]
          };
          break;
        default:
          throw "error";
      }
      const remoteRootEvents = await pool.querySync(readRelays(), {
        ...filterForRemoteRootEvents
      });
      const remoteRootNoteEvents = remoteRootEvents.map(eventToNoteEvent);
      for (const e of remoteRootNoteEvents) {
        if (anchor().type == "http") {
          if (e.k == 1 && e.c.includes("↴") || e.k == 8812) {
            save("events", e);
          }
        } else {
          save("events", e);
        }
      }
      switch (anchor().type) {
        case "http":
        case "naddr":
          const events2 = [...localRootEvents, ...remoteRootNoteEvents];
          const sortedEventIds = sortByDate([...events2]).map((e) => e.id);
          if ((sortedEventIds.length > 0 && sortedEventIds[0]) !== store.rootEventIds[0]) {
            store.rootEventIds = sortedEventIds;
          }
          break;
        case "note":
          store.rootEventIds = remoteRootNoteEvents.map((e) => e.id);
          break;
      }
      if (remoteRootNoteEvents.length > 0) {
        store.anchorAuthor = remoteRootNoteEvents[0].pk;
      }
    }));
    const rootEventIds = () => store.rootEventIds;
    createComputed(on([rootEventIds, requestedVersion], () => {
      switch (anchor().type) {
        case "http":
        case "note":
          if ((store.filter["#e"] ?? []).toString() !== rootEventIds().toString()) {
            store.filter = {
              "#e": rootEventIds()
            };
          }
          return;
        case "naddr":
          const existingAnchor = store.filter["#a"] && store.filter["#a"][0];
          if (anchor().value !== existingAnchor) {
            store.filter = {
              "#a": [anchor().value]
            };
          }
          store.version = requestedVersion() || rootEventIds()[0];
          return;
      }
    }, {
      defer: true
    }));
    const filter = createMemo(() => {
      return store.filter;
    }, {
      defer: true
    });
    const validEvent = async (id, powOrTags, kind, content2) => {
      if (store.validatedEvents.has(id)) {
        return store.validatedEvents.get(id);
      }
      const valid = content2.length <= store.maxCommentLength && (!store.validateReadPow || powIsOk(id, powOrTags, minReadPow())) && (!store.onReceive || await store.onReceive(id, kind, content2));
      store.validatedEvents.set(id, valid);
      return valid;
    };
    let sub;
    createEffect(on([filter, trackResubscribe], async () => {
      const _filter = filter();
      const _readRelays = readRelays();
      const _anchor = anchor();
      const _events = events();
      const _profiles = store.profiles();
      if (Object.entries(_filter).length === 0 || _readRelays.length === 0) {
        return;
      }
      sub == null ? void 0 : sub.close();
      sub = null;
      onCleanup(() => {
        console.log("[zapthreads] unsubscribing and cleaning up", _anchor.value);
        sub == null ? void 0 : sub.close();
        sub = null;
      });
      const kinds = [1, 9802, 7, 9735];
      console.log(`[zapthreads] subscribing to ${_anchor.value} on ${_readRelays}`);
      const since = await getRelayLatest(_anchor, _readRelays);
      const newLikeIds = /* @__PURE__ */ new Set();
      const newZaps = {};
      sub = pool.subscribeMany(_readRelays, [{
        ..._filter,
        kinds,
        since
      }], {
        onevent(e) {
          (async () => {
            const valid = await validEvent(e.id, e.tags, e.kind, e.content);
            if (e.kind === 1 || e.kind === 9802) {
              if (e.content.trim()) {
                if (valid) {
                  save("events", eventToNoteEvent(e));
                } else {
                  remove("events", [e.id]);
                }
              }
            } else if (e.kind === 7) {
              newLikeIds.add(e.id);
              if (e.content.trim()) {
                const reactionEvent = eventToReactionEvent(e);
                if (voteKind(reactionEvent) !== 0) {
                  if (valid) {
                    save("reactions", reactionEvent);
                  } else {
                    remove("reactions", [e.id]);
                  }
                }
              }
            } else if (e.kind === 9735) {
              const invoiceTag = e.tags.find((t) => t[0] === "bolt11");
              invoiceTag && invoiceTag[1] && (newZaps[e.id] = invoiceTag[1]);
            }
          })();
        },
        oneose() {
          (async () => {
            const likesAggregate = await find("aggregates", IDBKeyRange.only([_anchor.value, 7])) ?? {
              eid: _anchor.value,
              ids: [],
              k: 7
            };
            likesAggregate.ids = [.../* @__PURE__ */ new Set([...likesAggregate.ids, ...newLikeIds])];
            save("aggregates", likesAggregate);
            const zapsAggregate = await find("aggregates", IDBKeyRange.only([_anchor.value, 9735])) ?? {
              eid: _anchor.value,
              ids: [],
              k: 9735,
              sum: 0
            };
            zapsAggregate.sum = Object.entries(newZaps).reduce((acc, entry) => {
              if (zapsAggregate.ids.includes(entry[0]))
                return acc;
              const decoded = bolt11.decode(entry[1]);
              const amount = decoded.sections.find((e) => e.name === "amount");
              const sats = Number(amount.value) / 1e3;
              return acc + sats;
            }, zapsAggregate.sum ?? 0);
            zapsAggregate.ids = [.../* @__PURE__ */ new Set([...zapsAggregate.ids, ...Object.keys(newZaps)])];
            save("aggregates", zapsAggregate);
            await updateRelayInfos();
          })();
          setTimeout(async () => {
            await updateProfiles([..._events.map((e) => e.pk)], _readRelays, _profiles);
            saveRelayLatestForFilter(_anchor, _events);
            if (closeOnEose()) {
              sub == null ? void 0 : sub.close();
              pool.close(_readRelays);
            }
          }, 96);
        }
      });
    }, {
      defer: true
    }));
    const npubOrNsec = () => props.user;
    createComputed(on(npubOrNsec, (_) => {
      if (_) {
        let pubkey;
        if (_.startsWith("nsec")) {
          return;
        } else if (_.startsWith("npub")) {
          pubkey = decode$2(_).data;
        } else {
          pubkey = _;
        }
        signersStore.external = {
          pk: pubkey,
          signEvent: async (event) => {
            if (!window.nostr) {
              alert("Please log in with a NIP-07 extension such as Alby or nos2x");
              signersStore.active = void 0;
              throw "No extension available";
            }
            const extensionPubkey = await window.nostr.getPublicKey();
            const loggedInPubkey = pubkey;
            if (loggedInPubkey !== extensionPubkey) {
              const error = `ERROR: Event not signed. Supplied pubkey does not match extension pubkey. ${loggedInPubkey} !== ${extensionPubkey}`;
              signersStore.active = void 0;
              alert(error);
              throw error;
            } else {
              return window.nostr.signEvent(event);
            }
          }
        };
        signersStore.active = signersStore.external;
        updateRelays();
      }
    }));
    createComputed(on(npubOrNsec, (_) => {
      if (!_) {
        signersStore.active = void 0;
      }
    }, {
      defer: true
    }));
    const articles = watchAll(() => ["events", 30023, {
      index: "k"
    }]);
    const content = createMemo(() => {
      if (store.disableFeatures.includes("hideContent") && anchor().type === "naddr") {
        const [_, pubkey, identifier] = anchor().value.split(":");
        const contentEvent = articles().find((e) => e.d === identifier && e.pk === pubkey);
        if (contentEvent) {
          const c = `# ${contentEvent.tl}
 ${contentEvent.c}`;
          return parseContent({
            ...contentEvent,
            c
          }, store, []);
        }
      }
    });
    const eventsWatcher = createMemo(() => {
      switch (anchor().type) {
        case "http":
        case "note":
          return watchAll(() => ["events", store.rootEventIds, {
            index: "ro"
          }]);
        case "naddr":
          return watchAll(() => ["events", anchor().value, {
            index: "a"
          }]);
        default:
          return () => [];
      }
    });
    const events = () => eventsWatcher()();
    const nestedEvents = createMemo(() => {
      if (store.rootEventIds && store.rootEventIds.length) {
        return nest(events()).filter((e) => {
          return !(e.k === 9802 && e.children.length === 0);
        });
      }
      return [];
    });
    const topNestedEvents = () => {
      const userStartedReadingComments = store.userStartedReadingComments;
      const topNestedEvents2 = nestedEvents().filter((e) => {
        var _a2;
        return !userStartedReadingComments || ((_a2 = signersStore.active) == null ? void 0 : _a2.pk) == e.pk || store.topRootEventIds.has(e.id);
      });
      topNestedEvents2.forEach((e) => store.topRootEventIds.add(e.id));
      return topNestedEvents2;
    };
    const bottomNestedEvents = () => {
      return nestedEvents().filter((e) => !store.topRootEventIds.has(e.id));
    };
    const commentsLength = () => {
      return nestedEvents().reduce((acc, n) => acc + totalChildren(n), nestedEvents().length);
    };
    const firstLevelComments = () => nestedEvents().filter((n) => !n.parent).length;
    const reactions = watchAll(() => ["reactions"]);
    const votes = createMemo(() => reactions().filter((r) => voteKind(r) !== 0 && (!store.validatedEvents.has(r.eid) || store.validatedEvents.get(r.eid))));
    let rootElement;
    const visible = createVisibilityObserver({
      threshold: 0
    })(() => rootElement);
    let userStartedReadingCommentsTimer;
    createEffect(on([visible, firstLevelComments], () => {
      if (!store.userStartedReadingComments && visible() && firstLevelComments() > 0) {
        store.userObservedComments = true;
        setTimeout(() => {
          store.userStartedReadingComments = true;
        }, 3e3);
      }
    }));
    onCleanup(() => {
      clearTimeout(userStartedReadingCommentsTimer);
    });
    return (() => {
      var _el$ = _tmpl$(), _el$2 = _el$.firstChild;
      var _ref$ = rootElement;
      typeof _ref$ === "function" ? use(_ref$, _el$) : rootElement = _el$;
      insert(_el$2, style);
      insert(_el$, (() => {
        var _c$ = createMemo(() => !!content());
        return () => _c$() && (() => {
          var _el$3 = _tmpl$2();
          createRenderEffect(() => _el$3.innerHTML = content());
          return _el$3;
        })();
      })(), null);
      insert(_el$, (() => {
        var _c$2 = createMemo(() => anchor().type === "error");
        return () => _c$2() && [_tmpl$3(), (() => {
          var _el$5 = _tmpl$4(), _el$6 = _el$5.firstChild;
          insert(_el$6, () => anchor().value);
          return _el$5;
        })()];
      })(), null);
      insert(_el$, (() => {
        var _c$3 = createMemo(() => anchor().type !== "error");
        return () => _c$3() && [createMemo(() => createMemo(() => !!!store.disableFeatures.includes("reply"))() && createComponent(RootComment, {})), (() => {
          var _el$7 = _tmpl$5();
          insert(_el$7, (() => {
            var _c$4 = createMemo(() => commentsLength() > 0);
            return () => _c$4() && `${commentsLength()} comment${commentsLength() == 1 ? "" : "s"}`;
          })());
          return _el$7;
        })(), createComponent(Thread, {
          topNestedEvents,
          bottomNestedEvents,
          articles,
          votes,
          firstLevelComments
        })];
      })(), null);
      return _el$;
    })();
  };
  customElement("zap-threads", {
    anchor: "",
    version: "",
    "read-relays": "",
    user: "",
    author: "",
    disable: "",
    urls: "",
    "reply-placeholder": "",
    "legacy-url": "",
    languages: "",
    "max-comment-length": "",
    "min-read-pow": "",
    "max-write-pow": ""
  }, (props) => {
    return createComponent(ZapThreads2, {
      get anchor() {
        return props["anchor"] ?? "";
      },
      get version() {
        return props["version"] ?? "";
      },
      get readRelays() {
        return props["read-relays"] ?? "";
      },
      get user() {
        return props["user"] ?? "";
      },
      get author() {
        return props["author"] ?? "";
      },
      get disable() {
        return props["disable"] ?? "";
      },
      get urls() {
        return props["urls"] ?? "";
      },
      get replyPlaceholder() {
        return props["reply-placeholder"] ?? "";
      },
      get legacyUrl() {
        return props["legacy-url"] ?? "";
      },
      get languages() {
        return props["languages"] ?? "";
      },
      get maxCommentLength() {
        return props["max-comment-length"] ?? "";
      },
      get minReadPow() {
        return props["min-read-pow"] ?? "";
      },
      get maxWritePow() {
        return props["max-write-pow"] ?? "";
      }
    });
  });
  ZapThreads2.onLogin = function(cb) {
    store.onLogin = cb;
    return ZapThreads2;
  };
  ZapThreads2.onPublish = function(cb) {
    store.onPublish = cb;
    return ZapThreads2;
  };
  ZapThreads2.onReceive = function(cb) {
    store.onReceive = cb;
    return ZapThreads2;
  };
  return ZapThreads2;
}();
