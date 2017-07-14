import React from 'react';
import ReactDOM, { findDOMNode } from 'react-dom';
import PropTypes from 'prop-types';

const KEYCODES = {
  ESCAPE: 27, //ESC
};

// Portal组件本身内部不会渲染真正的实体(这里称真正的UI实体为实体组件，即我们传入的)，
// 而是将它渲染到body节点上：  核心方法 unstable_renderSubtreeIntoContainer
// 一个例外是如果传入了openByClickOn(一个element)，那么这个element将会接用来触发实体的打开（展示）
export default class Portal extends React.Component {
  static propTypes = {
    children: PropTypes.element.isRequired, // 必须传入一个child
    openByClickOn: PropTypes.element, // Portal组件本身渲染的用来触发实体组件，比如一个button
    closeOnEsc: PropTypes.bool, //是否监听keydown事件，按下Esc关闭实体组件
    closeOnOutsideClick: PropTypes.bool, //是否监听实体组件之外的点击事件来控制开关
    isOpen: PropTypes.bool,
    center: PropTypes.bool,
    isOpened: (props, propName, componentName) => {
      if (typeof props[propName] !== 'undefined') {
        return new Error(
          `Prop \`${propName}\` supplied to \`${componentName}\` was renamed to \`isOpen\`.
          https://github.com/tajo/react-portal/pull/82.`,
        );
      }
      return null;
    },
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    beforeClose: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  static defaultProps = {
    onOpen: () => {},
    onClose: () => {},
    onUpdate: () => {},
  };

  constructor() {
    super();
    this.state = { active: false };
    this.handleWrapperClick = this.handleWrapperClick.bind(this);
    this.closePortal = this.closePortal.bind(this);
    this.handleOutsideMouseClick = this.handleOutsideMouseClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.portal = null;
    this.node = null;
  }

  // 主要通过传入的props来决定要进行哪些监听事件的挂载
  componentDidMount() {
    if (this.props.closeOnEsc) {
      document.addEventListener('keydown', this.handleKeydown);
    }

    if (this.props.closeOnOutsideClick) {
      document.addEventListener('mouseup', this.handleOutsideMouseClick);
      document.addEventListener('touchstart', this.handleOutsideMouseClick);
    }
    // isOpen具有最高权限，在下面我们会继续遇到他
    if (this.props.isOpen) {
      this.openPortal();
    }
  }

  // 如果组件更新，比如isOpen被改变，re-render it.
  componentWillReceiveProps(newProps) {
    // portal's 'is open' state is handled through the prop isOpen
    if (typeof newProps.isOpen !== 'undefined') {
      if (newProps.isOpen) {
        if (this.state.active) {
          this.renderPortal(newProps);
        } else {
          this.openPortal(newProps);
        }
      }
      if (!newProps.isOpen && this.state.active) {
        this.closePortal(); //isUnmounted -> false => state.active = false
      }
    }

    // portal handles its own 'is open' state
    if (typeof newProps.isOpen === 'undefined' && this.state.active) {
      this.renderPortal(newProps);
    }
  }

  // 如果此组件要被移除的时候，需要清理所有监听事件
  // 并且强行关闭实体组件(忽略)
  componentWillUnmount() {
    if (this.props.closeOnEsc) {
      document.removeEventListener('keydown', this.handleKeydown);
    }

    if (this.props.closeOnOutsideClick) {
      document.removeEventListener('mouseup', this.handleOutsideMouseClick);
      document.removeEventListener('touchstart', this.handleOutsideMouseClick);
    }

    this.closePortal(true);
  }

  // Wrapper指代的是Portal组件本身这个容器
  // Portal的本质是创造一个容器，并且将传入的内容渲染到根节点之外的地方，
  // 使用自身包裹特性给内容物加上对应的控制逻辑，有点HOC的感觉。
  /**
   * 当传入了openByClickOn的时候，
   */
  handleWrapperClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.state.active) {
      return;
    }
    this.openPortal(); //state.active开关
  }

  /**
   * 触发场景：
   *  1.componentDidMount里如果遇到isOpen传入，直接打开。
   *  2.componentWillReceiveProps里Portal更新后进行传参更新，并打开
   *  3.handleWrapperClick，用来处理传入的openByClickOn里的调用，在其中打开
   */
  openPortal(props = this.props) {
    this.setState({ active: true }); // active:true - open!
    this.renderPortal(props, true); // 渲染到body下的portal包裹node里。（给children又加上一个wrapper)
    // 第二个参数isOpenning代表这是正式的打开过程，而非一些被动更新过程里的render，比如在componentWillReceiveProps
  }

  /**
   * isUnmounted 如果是Portal整体移除，那么便不需要进行state change
   */
  closePortal(isUnmounted = false) {
    // remove from DOM
    const resetPortalState = () => {
      if (this.node) {
        // 移除这个节点并且清理所有事件监听
        ReactDOM.unmountComponentAtNode(this.node);
        document.body.removeChild(this.node);
      }

      this.portal = null;
      this.node = null;

      if (isUnmounted !== true) {
        // 非Portal移除情况，state.active: false
        this.setState({ active: false });
      }
    };

    if (this.state.active) {
      if (this.props.beforeClose) {
        // 这个方法使用场景在于： 当触发了关闭时，不直接移除DOM，控制权移交。
        // 可以做一些动画后再调用传入的reserPortalState进行移除。
        this.props.beforeClose(this.node, resetPortalState);
      } else {
        resetPortalState();
      }
      // 当Portal已经被关闭时调用。
      this.props.onClose();
    }
  }
  /**
   * 点击非实体组件的时候处理关闭逻辑
   * 内置判断点击目标与实体组件的包含与否n
   */
  handleOutsideMouseClick(e) {
    // 已经关了？ 不作处理
    if (!this.state.active) {
      return;
    }
    // 找到Portal实体组件，判断是否点击目标是否属于内部。
    const root = findDOMNode(this.portal);
    if (root.contains(e.target) || (e.button && e.button !== 0)) {
      return;
    }
    // 注意这个很重要
    // 否则会存在一种情况是你点击的是实体组件背后被掩盖的元素
    // 那这个时候从节点关系上来说你的确点击了外部
    // 但是从视觉上来说你点击的是实体组件
    // 会造成行为与直觉预期不符
    // 所以要把冒泡给禁止
    e.stopPropagation();
    this.closePortal(); //isUnmounted -> false => state.active = false
  }

  // 针对closeOnEsc的处理事件
  handleKeydown(e) {
    if (e.keyCode === KEYCODES.ESCAPE && this.state.active) {
      this.closePortal(); //isUnmounted -> false => state.active = false
    }
  }

  /**
   * 
   * @param {Object} props 由 openPortal传入， 默认为Portal本身的props
   * @param {Boolean} isOpening 
   */
  renderPortal(props, isOpening) {
    if (!this.node) {
      // 创造一个pure wrapper(不做逻辑注入)
      // 挂载到body上
      this.node = document.createElement('div');
      document.body.style = "height: 100vh; width: 100vw;"
      this.node.className = this.props.center ? 'layout-body-center' : '';
      document.body.appendChild(this.node);
    }

    if (isOpening) {
      // 相当于首次打开，传入this.node用来方便做一些操作比如动画
      this.props.onOpen(this.node);
    }

    let children = props.children;
    // https://gist.github.com/jimfb/d99e0678e9da715ccf6454961ef04d1b
    if (typeof props.children.type === 'function') {
      children = React.cloneElement(props.children, {
        closePortal: this.closePortal,
      });
    }

    // 关键方法
    // unstable_renderSubtreeIntoContainer 在一个特定 DOM 里渲染组件
    // ReactDOM.unstable_renderSubtreeIntoContainer(
    //		parentComponent, // 父组件
    //		nextElement, // 子组件
    // 		container, // 要绑定的 DOM, 容器。
    //		callback // 更新好的回调
    // )
    // https://stackoverflow.com/questions/37314951/react-rendersubtreeintocontainer-use-case-example
    this.portal = ReactDOM.unstable_renderSubtreeIntoContainer(
      this,
      children,
      this.node,
      this.props.onUpdate,
    );
  }

  render() {
    if (this.props.openByClickOn) {
      return React.cloneElement(this.props.openByClickOn, {
        onClick: this.handleWrapperClick,
      });
    }
    return null;
  }
}
