import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { injectIntl, FormattedMessage } from 'react-intl';
import { isEqual } from 'lodash';
import isArray from 'lodash/isArray';
import { Checkbox, Form, Input, Select, Button } from 'antd';
import { rewardsValues } from '../../../common/constants/rewards';
import EditorToolbar from './EditorToolbar';
import Action from '../Button/Action';
import Body from '../Story/Body';
import requiresLogin from '../../auth/requiresLogin';
import withEditor from './withEditor';
import './Editor.less';

@requiresLogin
@Form.create()
@injectIntl
@withEditor
class Editor extends React.Component {
  static propTypes = {
    intl: PropTypes.shape().isRequired,
    form: PropTypes.shape().isRequired,
    htmlContent: PropTypes.string.isRequired,
    editorInput: PropTypes.node.isRequired,
    insertCode: PropTypes.func.isRequired,
    title: PropTypes.string,
    topics: PropTypes.arrayOf(PropTypes.string),
    body: PropTypes.string,
    reward: PropTypes.string,
    upvote: PropTypes.bool,
    loading: PropTypes.bool,
    isUpdating: PropTypes.bool,
    draftId: PropTypes.string,
    saving: PropTypes.bool,
    onUpdate: PropTypes.func,
    onDelete: PropTypes.func,
    onSubmit: PropTypes.func,
    onError: PropTypes.func,
  };

  static defaultProps = {
    title: '',
    topics: [],
    body: '',
    reward: rewardsValues.half,
    upvote: true,
    recentTopics: [],
    popularTopics: [],
    loading: false,
    isUpdating: false,
    saving: false,
    draftId: null,
    onUpdate: () => {},
    onDelete: () => {},
    onSubmit: () => {},
    onError: () => {},
  };

  state = {
    noContent: false,
  };

  componentDidMount() {
    this.setValues(this.props);

    // eslint-disable-next-line react/no-find-dom-node
    const select = ReactDOM.findDOMNode(this.select);
    if (select) {
      const selectInput = select.querySelector('input,textarea,div[contentEditable]');
      if (selectInput) {
        selectInput.setAttribute('autocorrect', 'off');
        selectInput.setAttribute('autocapitalize', 'none');
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    const { title, topics, body, reward, upvote, draftId } = this.props;
    if (
      title !== nextProps.title ||
      !isEqual(topics, nextProps.topics) ||
      body !== nextProps.body ||
      reward !== nextProps.reward ||
      upvote !== nextProps.upvote ||
      (draftId && nextProps.draftId === null)
    ) {
      this.setValues(nextProps);
    }
  }

  onUpdate = e => {
    // NOTE: antd doesn't update field value on Select before firing onChange
    // so we have to get value from event.
    const values = this.getValues(e);
    const topics = values.topics || [];
    const title = values.title || '';

    this.props.onUpdate({
      ...values,
      topics: topics.slice(0, 5),
      title: title.slice(0, 255),
    });
  };

  setValues = post => {
    this.props.form.setFieldsValue({
      title: post.title,
      topics: post.topics,
      reward: post.reward,
      upvote: post.upvote,
    });
    if (this.input) {
      this.input.value = post.body;
      this.renderMarkdown(this.input.value);
      this.resizeTextarea();
    }
  };

  getValues = e => {
    // NOTE: antd API is inconsistent and returns event or just value depending of input type.
    // this code extracts value from event based of event type
    // (array or just value for Select, proxy event for inputs and checkboxes)

    const values = {
      ...this.props.form.getFieldsValue(['title', 'topics', 'reward', 'upvote']),
    };

    if (!e) return values;

    if (isArray(e)) {
      values.topics = e;
    } else if (typeof e === 'string') {
      values.reward = e;
    } else if (e.target.type === 'textarea') {
      values.body = e.target.value;
    } else if (e.target.type === 'text') {
      values.title = e.target.value;
    } else if (e.target.type === 'checkbox') {
      values.upvote = e.target.checked;
    }

    return values;
  };

  //
  // Form validation and handling
  //

  handleSubmit = e => {
    // NOTE: Wrapping textarea in getFormDecorator makes it impossible
    // to control its selection what is needed for markdown formatting.
    // This code adds requirement for body input to not be empty.
    e.preventDefault();
    this.setState({ noContent: false });
    this.props.form.validateFieldsAndScroll((err, values) => {
      if (!err && this.input.value !== '') {
        this.props.onSubmit({
          ...values,
          body: this.input.value,
        });
      } else if (this.input.value === '') {
        const errors = {
          ...err,
          body: {
            errors: [
              {
                field: 'body',
                message: "Content can't be empty",
              },
            ],
          },
        };
        this.setState({ noContent: true });
        this.props.onError(errors);
      } else {
        this.props.onError(err);
      }
    });
  };

  checkTopics = (rule, value, callback) => {
    if (!value || value.length < 1 || value.length > 5) {
      callback('You have to add 1 to 5 topics');
    }

    value
      .map(topic => ({ topic, valid: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic) }))
      .filter(topic => !topic.valid)
      .map(topic => callback(`Topic ${topic.topic} is invalid`));

    callback();
  };

  //
  // Editor methods
  //

  handleDelete = e => {
    e.stopPropagation();
    e.preventDefault();
    this.props.onDelete();
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    const {
      intl,
      loading,
      isUpdating,
      saving,
      draftId,
      htmlContent,
      editorInput,
      insertCode,
    } = this.props;

    return (
      <Form className="Editor" layout="vertical" onSubmit={this.handleSubmit}>
        <Helmet>
          <title>
            {intl.formatMessage({ id: 'write_post', defaultMessage: 'Write post' })} - Busy
          </title>
        </Helmet>
        <Form.Item
          label={
            <span className="Editor__label">
              <FormattedMessage id="title" defaultMessage="Title" />
            </span>
          }
        >
          {getFieldDecorator('title', {
            rules: [
              {
                required: true,
                message: intl.formatMessage({
                  id: 'title_error_empty',
                  defaultMessage: 'title_error_empty',
                }),
              },
              {
                max: 255,
                message: intl.formatMessage({
                  id: 'title_error_too_long',
                  defaultMessage: "Title can't be longer than 255 characters.",
                }),
              },
            ],
          })(
            <Input
              ref={title => {
                this.title = title;
              }}
              onChange={this.onUpdate}
              className="Editor__title"
              placeholder={intl.formatMessage({
                id: 'title_placeholder',
                defaultMessage: 'Add title',
              })}
            />,
          )}
        </Form.Item>
        <Form.Item
          label={
            <span className="Editor__label">
              <FormattedMessage id="topics" defaultMessage="Topics" />
            </span>
          }
          extra={intl.formatMessage({
            id: 'topics_extra',
            defaultMessage:
              'Separate topics with commas. Only lowercase letters, numbers and hyphen character is permitted.',
          })}
        >
          {getFieldDecorator('topics', {
            rules: [
              {
                required: true,
                message: intl.formatMessage({
                  id: 'topics_error_empty',
                  defaultMessage: 'Please enter topics',
                }),
                type: 'array',
              },
              { validator: this.checkTopics },
            ],
          })(
            <Select
              ref={ref => {
                this.select = ref;
              }}
              onChange={this.onUpdate}
              className="Editor__topics"
              mode="tags"
              placeholder={intl.formatMessage({
                id: 'topics_placeholder',
                defaultMessage: 'Add story topics here',
              })}
              dropdownStyle={{ display: 'none' }}
              tokenSeparators={[' ', ',']}
            />,
          )}
        </Form.Item>
        <Form.Item
          validateStatus={this.state.noContent ? 'error' : ''}
          help={
            this.state.noContent &&
            intl.formatMessage({
              id: 'story_error_empty',
              defaultMessage: "Story content can't be empty.",
            })
          }
        >
          <EditorToolbar onSelect={insertCode} />
          {editorInput}
        </Form.Item>
        {htmlContent && (
          <Form.Item
            label={
              <span className="Editor__label">
                <FormattedMessage id="preview" defaultMessage="Preview" />
              </span>
            }
          >
            <Body full body={htmlContent} />
          </Form.Item>
        )}
        <Form.Item
          className={classNames({ Editor__hidden: isUpdating })}
          label={
            <span className="Editor__label">
              <FormattedMessage id="reward" defaultMessage="Reward" />
            </span>
          }
        >
          {getFieldDecorator('reward', { initialValue: this.props.reward })(
            <Select onChange={this.onUpdate} disabled={isUpdating}>
              <Select.Option value={rewardsValues.all}>
                <FormattedMessage id="reward_option_100" defaultMessage="100% Steem Power" />
              </Select.Option>
              <Select.Option value={rewardsValues.half}>
                <FormattedMessage id="reward_option_50" defaultMessage="50% SBD and 50% SP" />
              </Select.Option>
              <Select.Option value={rewardsValues.none}>
                <FormattedMessage id="reward_option_0" defaultMessage="Declined" />
              </Select.Option>
            </Select>,
          )}
        </Form.Item>
        <Form.Item className={classNames({ Editor__hidden: isUpdating })}>
          {getFieldDecorator('upvote', { valuePropName: 'checked', initialValue: true })(
            <Checkbox onChange={this.onUpdate} disabled={isUpdating}>
              <FormattedMessage id="like_post" defaultMessage="Like this post" />
            </Checkbox>,
          )}
        </Form.Item>
        <div className="Editor__bottom">
          <span className="Editor__bottom__info">
            <i className="iconfont icon-markdown" />{' '}
            <FormattedMessage
              id="markdown_supported"
              defaultMessage="Styling with markdown supported"
            />
          </span>
          <div className="Editor__bottom__right">
            {saving && (
              <span className="Editor__bottom__right__saving">
                <FormattedMessage id="saving" defaultMessage="Saving..." />
              </span>
            )}
            <Form.Item className="Editor__bottom__cancel">
              {draftId && (
                <Button type="danger" disabled={loading} onClick={this.handleDelete}>
                  <FormattedMessage id="draft_delete" defaultMessage="Delete this draft" />
                </Button>
              )}
            </Form.Item>
            <Form.Item className="Editor__bottom__submit">
              {isUpdating ? (
                <Action
                  primary
                  loading={loading}
                  disabled={loading}
                  text={intl.formatMessage({
                    id: loading ? 'post_send_progress' : 'post_update_send',
                    defaultMessage: loading ? 'Submitting' : 'Update post',
                  })}
                />
              ) : (
                <Action
                  primary
                  loading={loading}
                  disabled={loading}
                  text={intl.formatMessage({
                    id: loading ? 'post_send_progress' : 'post_send',
                    defaultMessage: loading ? 'Submitting' : 'Post',
                  })}
                />
              )}
            </Form.Item>
          </div>
        </div>
      </Form>
    );
  }
}

export default Editor;
