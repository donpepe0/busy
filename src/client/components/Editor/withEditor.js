import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { message, Icon, Input } from 'antd';
import { FormattedMessage } from 'react-intl';
import Dropzone from 'react-dropzone';
import { HotKeys } from 'react-hotkeys';
import readingTime from 'reading-time';
import { getAuthenticatedUser } from '../../reducers';
import { isValidImage, MAXIMUM_UPLOAD_SIZE, MAXIMUM_UPLOAD_SIZE_HUMAN } from '../../helpers/image';
import { remarkable } from '../Story/Body';

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

export default function withEditor(WrappedComponent) {
  @connect(state => ({
    user: getAuthenticatedUser(state),
  }))
  class EditorBase extends React.Component {
    static displayName = getDisplayName(WrappedComponent);

    static propTypes = {
      intl: PropTypes.shape().isRequired,
      user: PropTypes.shape().isRequired,
    };

    static hotkeys = {
      h1: 'ctrl+shift+1',
      h2: 'ctrl+shift+2',
      h3: 'ctrl+shift+3',
      h4: 'ctrl+shift+4',
      h5: 'ctrl+shift+5',
      h6: 'ctrl+shift+6',
      bold: 'ctrl+b',
      italic: 'ctrl+i',
      quote: 'ctrl+q',
      link: 'ctrl+k',
      image: 'ctrl+m',
    };

    constructor(props) {
      super(props);

      this.state = {
        html: '',
        dropzoneActive: false,
      };

      this.handleUpdate = this.handleUpdate.bind(this);
      this.insertCode = this.insertCode.bind(this);
    }

    componentDidMount() {
      if (this.input) {
        this.input.addEventListener('paste', this.handlePastedImage);
      }
    }

    setInput = input => {
      if (input && input.refs && input.refs.input) {
        this.originalInput = input.refs.input;
        // eslint-disable-next-line react/no-find-dom-node
        this.input = ReactDOM.findDOMNode(input.refs.input);
      }
    };

    setInputCursorPosition = pos => {
      if (this.input && this.input.setSelectionRange) {
        this.input.setSelectionRange(pos, pos);
      }
    };

    handlers = {
      h1: () => this.insertCode('h1'),
      h2: () => this.insertCode('h2'),
      h3: () => this.insertCode('h3'),
      h4: () => this.insertCode('h4'),
      h5: () => this.insertCode('h5'),
      h6: () => this.insertCode('h6'),
      bold: () => this.insertCode('b'),
      italic: () => this.insertCode('i'),
      quote: () => this.insertCode('q'),
      link: e => {
        e.preventDefault();
        this.insertCode('link');
      },
      image: () => this.insertCode('image'),
    };

    resizeTextarea = () => {
      if (this.originalInput) this.originalInput.resizeTextarea();
    };

    handleUpdate(e) {
      this.renderMarkdown(e.target.value);
    }

    handleImageInserted = (blob, callback, errorCallback) => {
      const { intl: { formatMessage }, user } = this.props;
      message.info(
        formatMessage({ id: 'notify_uploading_image', defaultMessage: 'Uploading image' }),
      );
      const formData = new FormData();
      formData.append('files', blob);

      fetch(`https://busy-img.herokuapp.com/@${user.name}/uploads`, {
        method: 'POST',
        body: formData,
      })
        .then(res => res.json())
        .then(res => callback(res.secure_url, blob.name))
        .catch(err => {
          console.log('err', err);
          errorCallback();
          message.error(
            formatMessage({
              id: 'notify_uploading_iamge_error',
              defaultMessage: "Couldn't upload image",
            }),
          );
        });
    };

    handleImageInvalid = () => {
      const { formatMessage } = this.props.intl;
      message.error(
        formatMessage(
          {
            id: 'notify_uploading_image_invalid',
            defaultMessage:
              'This file is invalid. Only image files with maximum size of {size} are supported',
          },
          { size: MAXIMUM_UPLOAD_SIZE_HUMAN },
        ),
      );
    };

    handlePastedImage = e => {
      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        Array.from(items).forEach(item => {
          if (item.kind === 'file') {
            e.preventDefault();

            const blob = item.getAsFile();

            if (!isValidImage(blob)) {
              this.handleImageInvalid();
              return;
            }

            this.setState({
              imageUploading: true,
            });

            this.handleImageInserted(blob, this.disableAndInsertImage, () =>
              this.setState({
                imageUploading: false,
              }),
            );
          }
        });
      }
    };

    handleImageChange = e => {
      if (e.target.files && e.target.files[0]) {
        if (!isValidImage(e.target.files[0])) {
          this.handleImageInvalid();
          return;
        }

        this.setState({
          imageUploading: true,
        });
        this.handleImageInserted(e.target.files[0], this.disableAndInsertImage, () =>
          this.setState({
            imageUploading: false,
          }),
        );

        e.target.value = '';
      }
    };

    handleDrop = files => {
      if (files.length === 0) {
        this.setState({
          dropzoneActive: false,
        });
        return;
      }

      this.setState({
        dropzoneActive: false,
        imageUploading: true,
      });
      let callbacksCount = 0;
      Array.from(files).forEach(item => {
        this.handleImageInserted(
          item,
          (image, imageName) => {
            callbacksCount += 1;
            this.insertImage(image, imageName);
            if (callbacksCount === files.length) {
              this.setState({
                imageUploading: false,
              });
            }
          },
          () => {
            this.setState({
              imageUploading: false,
            });
          },
        );
      });
    };

    handleDragEnter = () => this.setState({ dropzoneActive: true });

    handleDragLeave = () => this.setState({ dropzoneActive: false });

    insertAtCursor = (before, after, deltaStart = 0, deltaEnd = 0) => {
      if (!this.input) return;

      const startPos = this.input.selectionStart;
      const endPos = this.input.selectionEnd;
      this.input.value =
        this.input.value.substring(0, startPos) +
        before +
        this.input.value.substring(startPos, endPos) +
        after +
        this.input.value.substring(endPos, this.input.value.length);

      this.input.selectionStart = startPos + deltaStart;
      this.input.selectionEnd = endPos + deltaEnd;
    };

    disableAndInsertImage = (image, imageName = 'image') => {
      this.setState({
        imageUploading: false,
      });
      this.insertImage(image, imageName);
    };

    insertImage = (image, imageName = 'image') => {
      if (!this.input) return;

      const startPos = this.input.selectionStart;
      const endPos = this.input.selectionEnd;
      const imageText = `![${imageName}](${image})\n`;
      this.input.value = `${this.input.value.substring(
        0,
        startPos,
      )}${imageText}${this.input.value.substring(endPos, this.input.value.length)}`;
      this.resizeTextarea();
      this.renderMarkdown(this.input.value);
      this.setInputCursorPosition(startPos + imageText.length);
    };

    insertCode = type => {
      if (!this.input) return;
      this.input.focus();

      switch (type) {
        case 'h1':
          this.insertAtCursor('# ', '', 2, 2);
          break;
        case 'h2':
          this.insertAtCursor('## ', '', 3, 3);
          break;
        case 'h3':
          this.insertAtCursor('### ', '', 4, 4);
          break;
        case 'h4':
          this.insertAtCursor('#### ', '', 5, 5);
          break;
        case 'h5':
          this.insertAtCursor('##### ', '', 6, 6);
          break;
        case 'h6':
          this.insertAtCursor('###### ', '', 7, 7);
          break;
        case 'b':
          this.insertAtCursor('**', '**', 2, 2);
          break;
        case 'i':
          this.insertAtCursor('*', '*', 1, 1);
          break;
        case 'q':
          this.insertAtCursor('> ', '', 2, 2);
          break;
        case 'link':
          this.insertAtCursor('[', '](url)', 1, 1);
          break;
        case 'image':
          this.insertAtCursor('![', '](url)', 2, 2);
          break;
        default:
          break;
      }

      this.resizeTextarea();
      this.renderMarkdown(this.input.value);
    };

    renderMarkdown(value) {
      this.setState({
        html: remarkable.render(value),
      });
    }

    render() {
      const { html, dropzoneActive } = this.state;

      const input = (
        <React.Fragment>
          <div className="Editor__dropzone-base">
            <Dropzone
              disableClick
              style={{}}
              accept="image/*"
              maxSize={MAXIMUM_UPLOAD_SIZE}
              onDropRejected={this.handleImageInvalid}
              onDrop={this.handleDrop}
              onDragEnter={this.handleDragEnter}
              onDragLeave={this.handleDragLeave}
            >
              {dropzoneActive && (
                <div className="Editor__dropzone">
                  <div>
                    <i className="iconfont icon-picture" />
                    <FormattedMessage id="drop_image" defaultMessage="Drop your images here" />
                  </div>
                </div>
              )}
              <HotKeys keyMap={this.constructor.hotkeys} handlers={this.handlers}>
                <Input
                  autosize={{ minRows: 6, maxRows: 12 }}
                  onChange={this.handleUpdate}
                  ref={ref => this.setInput(ref)}
                  type="textarea"
                />
              </HotKeys>
            </Dropzone>
          </div>
          <p className="Editor__imagebox">
            <input type="file" id="inputfile" accept="image/*" onChange={this.handleImageChange} />
            <label htmlFor="inputfile">
              {this.state.imageUploading ? (
                <Icon type="loading" />
              ) : (
                <i className="iconfont icon-picture" />
              )}
              {this.state.imageUploading ? (
                <FormattedMessage id="image_uploading" defaultMessage="Uploading your image..." />
              ) : (
                <FormattedMessage
                  id="select_or_past_image"
                  defaultMessage="Select image or paste it from the clipboard."
                />
              )}
            </label>
            <label htmlFor="reading_time" className="Editor__reading_time">
              <FormattedMessage
                id="reading_time"
                defaultMessage={'{words} words / {min} min read'}
                values={{
                  words: readingTime(html).words,
                  min: Math.ceil(readingTime(html).minutes),
                }}
              />
            </label>
          </p>
        </React.Fragment>
      );

      return (
        <WrappedComponent
          htmlContent={html}
          editorInput={input}
          insertCode={this.insertCode}
          {...this.props}
        />
      );
    }
  }

  return EditorBase;
}
