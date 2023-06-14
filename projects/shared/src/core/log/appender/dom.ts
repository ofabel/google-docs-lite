import * as uid from '../../uid';
import {Level} from '../level';
import {AbstractAppender, AbstractAppenderConfig, Loggable} from './abstract';

export type DomAppenderConfig = AbstractAppenderConfig & {
  type: 'DOM';
  target: string;
  limit?: number;
  prepend?: boolean;
  styles?: boolean;
}

export class DomAppender extends AbstractAppender {
  protected readonly id = uid.full();
  protected readonly node: HTMLElement | null;
  protected readonly table: HTMLTableSectionElement;
  protected readonly shadowTable: HTMLTableElement;
  protected readonly filter: HTMLInputElement;
  protected readonly limit: number;
  protected readonly prepend: boolean;

  protected filterQuery = '';

  public constructor(config: DomAppenderConfig) {
    super(config);

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      throw new Error('cannot use DOM log appender, document is undefined');
    }

    this.node = document?.querySelector(config.target);

    if (config.styles ?? true) {
      this.initStyles();
    }

    const filter = this.initFilter();
    const [table, body] = this.initTable();

    this.node?.setAttribute('data-dom-appender-id', this.id);
    this.node?.append(filter, table);
    this.table = body;
    this.shadowTable = document.createElement('table');
    this.filter = filter;
    this.limit = config.limit && config.limit > 0 ? config.limit : 10_000;
    this.prepend = config.prepend ?? true;
  }

  public append(rawLevel: Level, category: string, instance: string, rawTimestamp: Date, ...rawData: Loggable[]): void {
    const row = document.createElement('tr');

    const level = Level[rawLevel];
    const timestamp = rawTimestamp.toISOString();
    const data = rawData.join(' ');

    const timestampCell = this.getElementWithTextContent('td', timestamp);
    const instanceCell = this.getElementWithTextContent('td', instance);
    const levelCell = this.getElementWithTextContent('td', level);
    const categoryCell = this.getElementWithTextContent('td', category);
    const dataCell = this.getElementWithTextContent('td', data);

    row.setAttribute('data-timestamp', timestamp);
    row.setAttribute('data-instance', instance);
    row.setAttribute('data-level', level);
    row.setAttribute('data-category', category);
    row.setAttribute('data-data', data);

    instanceCell.onclick = () => this.appendFilterQuery(`[data-instance="${instance}"]`);
    levelCell.onclick = () => this.appendFilterQuery(`[data-level="${level}"]`);
    categoryCell.onclick = () => this.appendFilterQuery(`[data-category="${category}"]`);

    row.append(timestampCell, instanceCell, levelCell, categoryCell, dataCell);

    this.shadowTable.append(row);

    this.applyFilterOnTarget(this.shadowTable);

    this.shadowTable.removeChild(row);

    if (this.prepend) {
      this.table.prepend(row);
    } else {
      this.table.append(row);
    }

    this.truncate();
  }

  protected initFilter(): HTMLInputElement {
    const input = document.createElement('input');

    input.placeholder = '[data-category^="..."]'
    input.onkeyup = event => this.handleFilterEvent(event);

    return input;
  }

  protected handleFilterEvent(event: KeyboardEvent): void {
    if (event.code.indexOf('Enter') !== -1) {
      this.setFilterQuery(this.filter.value);
    }
  }

  protected filterResults(target: Element): Set<Element> | undefined {
    try {
      const results = target.querySelectorAll(this.filterQuery);

      return new Set<Element>(results);
    } catch (_e) {
      return undefined;
    }
  }

  protected appendFilterQuery(query: string): void {
    this.setFilterQuery(this.filter.value + query);
  }

  protected setFilterQuery(query: string): void {
    this.filter.value = query;
    this.filterQuery = query;

    this.applyFilterOnTarget(this.table);
  }

  protected applyFilterOnTarget(target: Element): void {
    const rows = this.filterResults(target);

    for (const node of target.children) {
      if (node instanceof HTMLElement) {
        node.hidden = rows ? !rows.has(node) : false;
      }
    }
  }

  protected initTable(): [table: HTMLTableElement, body: HTMLTableSectionElement] {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const timestamp = this.getElementWithTextContent('th', 'Timestamp');
    const instance = this.getElementWithTextContent('th', 'Instance');
    const level = this.getElementWithTextContent('th', 'Level');
    const category = this.getElementWithTextContent('th', 'Category');
    const data = this.getElementWithTextContent('th', 'Data');

    thead.append(timestamp, instance, level, category, data);

    table.append(thead, tbody);

    return [table, tbody];
  }

  protected getElementWithTextContent(tag: keyof HTMLElementTagNameMap, text: string): HTMLElement {
    const element = document.createElement(tag);

    element.textContent = text;

    return element;
  }

  protected truncate(): void {
    const start = this.prepend ? this.table.children.length : this.table.children.length - this.limit;

    for (let i = start; this.table.children.length > this.limit; i--) {
      const element = this.table.children[i - 1];

      element.remove();
    }
  }

  protected initStyles(): void {
    const selector = `[data-dom-appender-id="${this.id}"]`;
    const style = this.getStyleTag(selector);

    document.head.append(style);
  }

  protected getStyleTag(topLevelSelector: string): HTMLStyleElement {
    const cssStyles = `
${topLevelSelector} {
  font-family: sans-serif;
  display: flex;
  flex-direction: column;
}

${topLevelSelector} table {
  border-collapse: collapse;
}

${topLevelSelector} thead > th {
  text-align: left;
}

${topLevelSelector} tbody {
  font-family: monospace, serif;
}

${topLevelSelector} tbody > tr:hover > td {
  background-color: rgba(0,0,0,0.08);
}

${topLevelSelector} tbody > tr > td {
  white-space: nowrap;
  padding-right: 1rem;
}

${topLevelSelector} tbody > tr > td:nth-child(2),
${topLevelSelector} tbody > tr > td:nth-child(3),
${topLevelSelector} tbody > tr > td:nth-child(4){
  cursor: pointer;
}

${topLevelSelector} tbody > tr > td:last-child {
  width: 100%;
  white-space: normal;
  padding-right: 0;
}`.trim();

    const style = document.createElement('style') as HTMLStyleElement;
    style.textContent = cssStyles;

    return style;
  }
}
