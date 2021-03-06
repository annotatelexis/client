import selections from '../selections';
import * as observable from '../util/observable';

function FakeDocument() {
  const listeners = {};

  return {
    getSelection: function () {
      return this.selection;
    },

    addEventListener: function (name, listener) {
      listeners[name] = (listeners[name] || []).concat(listener);
    },

    removeEventListener: function (name, listener) {
      listeners[name] = listeners[name].filter(function (lis) {
        return lis !== listener;
      });
    },

    dispatchEvent: function (event) {
      listeners[event.type].forEach(function (fn) {
        fn(event);
      });
    },
  };
}

describe('selections', function () {
  let clock;
  let fakeDocument;
  let range;
  let rangeSub;
  let onSelectionChanged;

  beforeEach(function () {
    clock = sinon.useFakeTimers();
    fakeDocument = new FakeDocument();
    onSelectionChanged = sinon.stub();

    // Subscribe to selection changes, ignoring the initial event
    const ranges = observable.drop(selections(fakeDocument), 1);
    rangeSub = ranges.subscribe({ next: onSelectionChanged });

    range = {};
    fakeDocument.selection = {
      rangeCount: 1,
      getRangeAt: function (index) {
        return index === 0 ? range : null;
      },
    };
  });

  afterEach(function () {
    rangeSub.unsubscribe();
    clock.restore();
  });

  it('emits the selected range when mouseup occurs', function () {
    fakeDocument.dispatchEvent({ type: 'mouseup' });
    clock.tick(20);
    assert.calledWith(onSelectionChanged, range);
  });

  it('emits an event if there is a selection at the initial subscription', function () {
    const onInitialSelection = sinon.stub();
    const ranges = selections(fakeDocument);
    const sub = ranges.subscribe({ next: onInitialSelection });
    clock.tick(1);
    assert.called(onInitialSelection);
    sub.unsubscribe();
  });

  describe('when the selection changes', function () {
    it('emits a selection if the mouse is not down', function () {
      fakeDocument.dispatchEvent({ type: 'selectionchange' });
      clock.tick(200);
      assert.calledWith(onSelectionChanged, range);
    });

    it('does not emit a selection if the mouse is down', function () {
      fakeDocument.dispatchEvent({ type: 'mousedown' });
      fakeDocument.dispatchEvent({ type: 'selectionchange' });
      clock.tick(200);
      assert.notCalled(onSelectionChanged);
    });

    it('does not emit a selection until there is a pause since the last change', function () {
      fakeDocument.dispatchEvent({ type: 'selectionchange' });
      clock.tick(90);
      fakeDocument.dispatchEvent({ type: 'selectionchange' });
      clock.tick(90);
      assert.notCalled(onSelectionChanged);
      clock.tick(20);
      assert.called(onSelectionChanged);
    });
  });
});
