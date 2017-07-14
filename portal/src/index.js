import React, { Component } from 'react';
import { render } from 'react-dom';
import Portal from './portal';
import SharePopUp from './sharePopUp';
import './base.css';

class App extends Component {
  render() {
    const button1 = <button>Open portal with pseudo modal</button>;
    return (
      <Portal center closeOnEsc closeOnOutsideClick openByClickOn={button1}>
        <SharePopUp>
          <h2 className="share-title-h2">share pop op goese here</h2>
          <p className="share-body-p">
            This react component is appended to the document body.
          </p>
        </SharePopUp>
      </Portal>
    );
  }
}

render(<App />, document.getElementById('root'));
