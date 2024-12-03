/* Manifest & action definitions */

export interface AppletManifest {
  name?: string;
  short_name?: string;
  icons: AppletIcons;
  description?: string;
  icon?: string;
  display?: string;
  start_url?: string;
  unsafe?: boolean;
  actions?: AppletAction[];
}

export interface AppletIcons {
  src: string;
  purpose?: string;
  sizes?: string;
  type?: string;
}

export interface AppletAction {
  id: string;
  name?: string;
  description?: string;
  params?: JSONSchemaProperties;
}

export type JSONSchemaProperties = Record<
  string,
  {
    description: string;
    type: string;
    properties: JSONSchemaProperties;
  }
>;

export type ActionParams<T = any> = Record<string, T>;

/* MessageChannel object (Applet & AppletContext inherit this) */

export class AppletMessageChannel extends EventTarget {
  messageTarget: Window;

  async send(message: AppletMessage) {
    this.messageTarget.postMessage(message.toJson(), '*');

    // Wait for a resolve message to be sent back before completing await
    return new Promise<AppletMessage>((resolve) => {
      const listener = (messageEvent: MessageEvent) => {
        const responseMessage = new AppletMessage(
          messageEvent.data.type,
          messageEvent.data
        );

        if (
          responseMessage.type === 'resolve' &&
          responseMessage.id === message.id
        ) {
          window.removeEventListener('message', listener);
          resolve(responseMessage);
        }
      };

      window.addEventListener('message', listener);
    });
  }

  async on(messageType: AppletMessageType, callback: AppletMessageCallback) {
    const listener = async (messageEvent: MessageEvent<AppletMessage>) => {
      if (messageEvent.source !== this.messageTarget) return;
      if (messageEvent.data.type !== messageType) return;

      const message = new AppletMessage(
        messageEvent.data.type,
        messageEvent.data
      );

      // Wait for the callback to complete, then send a 'resolve' event
      // with the message ID
      await callback(message);
      this.messageTarget.postMessage(
        new AppletMessage('resolve', { id: message.id }),
        '*'
      );
    };

    window.addEventListener('message', listener);
  }

  emitEvent(id: string, detail: any) {
    const event = new CustomEvent(id, { detail });
    if (typeof this[`on${id}`] === 'function') {
      this[`on${id}`](detail);
    }
    this.dispatchEvent(event);
  }
}

/* Messages */

export class AppletMessage {
  type: AppletMessageType;
  id: string;
  timeStamp: number;
  [key: string]: any;

  constructor(type: AppletMessageType, values?: { [key: string]: any }) {
    this.timeStamp = Date.now();
    this.type = type;
    this.id = crypto.randomUUID();
    if (values) Object.assign(this, values);
  }

  toJson() {
    return Object.fromEntries(
      Object.entries(this).filter(([_, value]) => {
        try {
          JSON.stringify(value);
          return true;
        } catch {
          return false;
        }
      })
    );
  }
}

export class AppletDataMessage<T = any> extends AppletMessage {
  data: T;

  constructor({ data }: { data: T }) {
    super('data');
    this.data = data;
  }
}

export class AppletResizeMessage extends AppletMessage {
  dimensions: { height: number; width: number };

  constructor({
    dimensions,
  }: {
    dimensions: AppletResizeMessage['dimensions'];
  }) {
    super('resize');
    this.dimensions = dimensions;
  }
}

export class AppletActionMessage<T = any> extends AppletMessage {
  type: 'action';
  actionId: string;
  params: T;
}

export interface AppletInitMessage extends AppletMessage {
  type: 'init';
}

export type AppletMessageType =
  | 'action'
  | 'actions'
  | 'data'
  | 'init'
  | 'ready'
  | 'resolve'
  | 'resize';

export type AppletMessageCallback = (
  message: AppletMessage
) => Promise<void> | void;

/* Events */

export class AppletDataEvent extends Event {
  data: any;

  constructor({ data }: { data: any }) {
    super('data', {
      bubbles: false,
      cancelable: false,
      composed: false,
    });

    this.data = data;
  }
}
