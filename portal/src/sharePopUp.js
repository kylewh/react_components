import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './sharePopUp.css';

class SharePopUp extends Component {
  static propTypes = {
    closePortal: PropTypes.func.isRequired,
    center: PropTypes.boolean,
  };
  render() {
    const popupClass = classNames('share-pop-up');
    return (
      <div className={popupClass}>
        {this.props.children}
        <p>
          <button className="share-close-btn" onClick={this.props.closePortal}>
            Close
          </button>
        </p>
      </div>
    );
  }
}

export default SharePopUp;
