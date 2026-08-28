import type { FieldOrder } from './tsDataFile';

export interface FieldDef extends FieldOrder {
  label: string;
  help?: string;
  inputType?: 'text' | 'textarea' | 'checkbox' | 'number' | 'image';
}

export interface DataTypeSchema {
  key: string; // used in routes, e.g. "members"
  label: string; // 中文顯示名稱
  path: string; // src/data/xxx.ts
  idField: string;
  titleField: string; // which field to show as the row's main label in lists
  fields: FieldDef[];
  /** Where "cancel"/save should navigate back to — the page that actually
   *  renders this data (advisors/generations are shown on the members page,
   *  not their own route). */
  listRoute: string;
}

export const dataSchemas: Record<string, DataTypeSchema> = {
  members: {
    key: 'members',
    label: '成員',
    path: 'src/data/members.ts',
    idField: 'id',
    titleField: 'name',
    listRoute: '/members',
    fields: [
      { key: 'id', type: 'string', label: 'ID', help: '唯一識別碼，例如 huangjr，建立後不要更改' },
      { key: 'name', type: 'string', label: '姓名' },
      {
        key: 'generation',
        type: 'string',
        label: '屆別 ID',
        help: '要跟「屆別」清單裡的 ID 完全一致，例如 gen-01',
      },
      { key: 'class', type: 'string', label: '班級' },
      { key: 'role', type: 'string', label: '職位' },
      { key: 'isLeader', type: 'boolean', label: '是隊長', inputType: 'checkbox' },
      { key: 'roleTag', type: 'boolean', label: '職位以標籤樣式顯示', inputType: 'checkbox' },
      { key: 'photo', type: 'string', label: '照片', inputType: 'image' },
      { key: 'order', type: 'number', label: '排序（同屆內）', inputType: 'number' },
    ],
  },
  generations: {
    key: 'generations',
    label: '屆別',
    path: 'src/data/generations.ts',
    idField: 'id',
    titleField: 'label',
    listRoute: '/members',
    fields: [
      { key: 'id', type: 'string', label: 'ID', help: '例如 gen-01，成員資料要引用這個值' },
      { key: 'label', type: 'string', label: '屆別名稱', help: '例如 第一屆' },
      { key: 'year', type: 'string', label: '年級', help: '例如 大四' },
      {
        key: 'isAlumni',
        type: 'boolean',
        label: '已畢業',
        help: '打勾後，這屆成員會從主頁移到「歷屆學長姐」下拉選單，選擇後才會展開',
        inputType: 'checkbox',
      },
      { key: 'order', type: 'number', label: '排序', inputType: 'number' },
    ],
  },
  advisors: {
    key: 'advisors',
    label: '指導老師',
    path: 'src/data/advisors.ts',
    idField: 'id',
    titleField: 'name',
    listRoute: '/members',
    fields: [
      { key: 'id', type: 'string', label: 'ID' },
      { key: 'name', type: 'string', label: '姓名' },
      { key: 'title', type: 'string', label: '職稱' },
      { key: 'bio', type: 'string', label: '簡介', inputType: 'textarea' },
      { key: 'email', type: 'string', label: 'Email' },
      { key: 'photo', type: 'string', label: '照片', inputType: 'image' },
      { key: 'order', type: 'number', label: '排序', inputType: 'number' },
    ],
  },
  sponsors: {
    key: 'sponsors',
    label: '贊助商',
    path: 'src/data/sponsors.ts',
    idField: 'id',
    titleField: 'name',
    listRoute: '/sponsors',
    fields: [
      { key: 'id', type: 'string', label: 'ID' },
      { key: 'name', type: 'string', label: '名稱（中文）' },
      { key: 'nameEn', type: 'string', label: '名稱（英文）' },
      { key: 'logo', type: 'string', label: 'Logo', inputType: 'image' },
      { key: 'blurb', type: 'string', label: '簡介', inputType: 'textarea' },
      { key: 'order', type: 'number', label: '排序', inputType: 'number' },
    ],
  },
  history: {
    key: 'history',
    label: '隊史',
    path: 'src/data/history.ts',
    idField: 'id',
    titleField: 'title',
    listRoute: '/history',
    fields: [
      { key: 'id', type: 'string', label: 'ID', help: '唯一識別碼，用於首頁隊史深連結，建立後不要更改' },
      { key: 'date', type: 'string', label: '日期', help: '例如 2026.03.28' },
      { key: 'title', type: 'string', label: '標題' },
      { key: 'body', type: 'string', label: '內容', inputType: 'textarea' },
      { key: 'milestone', type: 'boolean', label: '標記為里程碑', inputType: 'checkbox' },
      { key: 'order', type: 'number', label: '排序', inputType: 'number' },
    ],
  },
};
