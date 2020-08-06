import * as observable from './util/observable';

/** Returns the selected `DOMRange` in `document`. */
function selectedRange(document) {
  snapSelectionToWord(document);
  const selection = document.getSelection();
  if (!selection.rangeCount || selection.getRangeAt(0).collapsed) {
    return null;
  } else {
    return selection.getRangeAt(0);
  }
}

/**
 * Returns an Observable stream of text selections in the current document.
 *
 * New values are emitted when the user finishes making a selection
 * (represented by a `DOMRange`) or clears a selection (represented by `null`).
 *
 * A value will be emitted with the selected range at the time of subscription
 * on the next tick.
 *
 * @return Observable<DOMRange|null>
 */
export default function selections(document) {
  // Get a stream of selection changes that occur whilst the user is not
  // making a selection with the mouse.
  let isMouseDown;
  const selectionEvents = observable
    .listen(document, ['mousedown', 'mouseup', 'selectionchange'])
    .filter(function (event) {
      if (event.type === 'mousedown' || event.type === 'mouseup') {
        isMouseDown = event.type === 'mousedown';
        return false;
      } else {
        return !isMouseDown;
      }
    });

  const events = observable.merge([
    // Add a delay before checking the state of the selection because
    // the selection is not updated immediately after a 'mouseup' event
    // but only on the next tick of the event loop.
    observable.buffer(10, observable.listen(document, ['mouseup'])),

    // Buffer selection changes to avoid continually emitting events whilst the
    // user drags the selection handles on mobile devices
    observable.buffer(100, selectionEvents),

    // Emit an initial event on the next tick
    observable.delay(0, observable.Observable.of({})),
  ]);

  return events.map(function () {
    return selectedRange(document);
  });
}

//Credit: https://stackoverflow.com/a/10964743/5827002
function snapSelectionToWord(document) {
  let sel;

  if (document.getSelection && (sel = document.getSelection()).modify) {
    sel = document.getSelection();
    if (!sel.isCollapsed) {
      // Detect if selection is backwards
      let range = document.createRange();
      range.setStart(sel.anchorNode, sel.anchorOffset);
      range.setEnd(sel.focusNode, sel.focusOffset);
      let backwards = range.collapsed;
      range.detach();

      // modify() works on the focus of the selection
      let endNode = sel.focusNode,
        endOffset = sel.focusOffset;
      sel.collapse(sel.anchorNode, sel.anchorOffset);
      if (backwards) {
        sel.modify('move', 'backward', 'character');
        sel.modify('move', 'forward', 'word');
        sel.extend(endNode, endOffset);
        sel.modify('extend', 'forward', 'character');
        sel.modify('extend', 'backward', 'word');
      } else {
        sel.modify('move', 'forward', 'character');
        sel.modify('move', 'backward', 'word');
        sel.extend(endNode, endOffset);
        sel.modify('extend', 'backward', 'character');
        sel.modify('extend', 'forward', 'word');
      }
    }
  } else if ((sel = document.selection) && sel.type !== 'Control') {
    let textRange = sel.createRange();
    if (textRange.text) {
      textRange.expand('word');
      // Move the end back to not include the word's trailing space(s),
      // if necessary
      while (/\s$/.test(textRange.text)) {
        textRange.moveEnd('character', -1);
      }
      textRange.select();
    }
  }
}
