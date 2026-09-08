'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Dices, Grid2X2, Languages, List, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import vocabulary from './vocabulary.json';

type Language = 'thai' | 'english';
type ViewMode = 'cards' | 'list';
type WordEntry = { id: number; word: string; meaning?: string; grade?: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type Results = Record<Difficulty, WordEntry[]>;

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const DIFFICULTIES: Array<{ key: Difficulty; title: string; subtitle: string; count: number; tone: string; dot: string }> = [
  { key: 'easy', title: 'คำง่าย', subtitle: 'เริ่มต้นอย่างมั่นใจ', count: 7, tone: 'border-[#95dec6] bg-[#effbf6]', dot: 'bg-[#14a57b]' },
  { key: 'medium', title: 'คำยากปานกลาง', subtitle: 'เพิ่มความท้าทาย', count: 8, tone: 'border-[#ffd38b] bg-[#fff8e8]', dot: 'bg-[#f39b20]' },
  { key: 'hard', title: 'คำยาก', subtitle: 'ฝึกให้เก่งขึ้น', count: 5, tone: 'border-[#bbb8ff] bg-[#f3f2ff]', dot: 'bg-[#625bf6]' },
];

const EMPTY_RESULTS: Results = { easy: [], medium: [], hard: [] };

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function complexity(entry: WordEntry, language: Language) {
  const cleanLength = [...entry.word.replace(/[\s()]/g, '')].length;
  const clusters = language === 'thai'
    ? (entry.word.match(/[เแโใไัิีึืุู็่้๊๋์]/g) || []).length
    : (entry.word.match(/[aeiouy]+/gi) || []).length;
  return cleanLength + clusters * 0.45 + (entry.word.includes(' ') ? 3 : 0) + (entry.grade || 1) * 0.7;
}

function makeBuckets(entries: WordEntry[], language: Language) {
  const sorted = [...entries].sort((a, b) => complexity(a, language) - complexity(b, language) || a.id - b.id);
  const easyEnd = Math.max(7, Math.floor(sorted.length * 0.35));
  const mediumEnd = Math.max(easyEnd + 8, Math.floor(sorted.length * 0.75));
  return { easy: sorted.slice(0, easyEnd), medium: sorted.slice(easyEnd, mediumEnd), hard: sorted.slice(mediumEnd) };
}

function pickWords(entries: WordEntry[], language: Language, random = true): Results {
  if (!entries.length) return EMPTY_RESULTS;
  const buckets = makeBuckets(entries, language);
  return {
    easy: (random ? shuffled(buckets.easy) : buckets.easy).slice(0, 7),
    medium: (random ? shuffled(buckets.medium) : buckets.medium).slice(0, 8),
    hard: (random ? shuffled(buckets.hard) : buckets.hard).slice(0, 5),
  };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('thai');
  const [grade, setGrade] = useState('1');
  const [view, setView] = useState<ViewMode>('cards');
  const [showMeaning, setShowMeaning] = useState(true);
  const [round, setRound] = useState(1);

  const pool = useMemo(() => {
    const source = vocabulary[language] as Record<string, WordEntry[]>;
    const grades = grade === 'all' ? ['1', '2', '3', '4', '5', '6'] : [grade];
    return grades.flatMap((currentGrade) => source[currentGrade].map((entry) => ({ ...entry, grade: Number(currentGrade) })));
  }, [grade, language]);

  const [results, setResults] = useState<Results>(() => pickWords(
    (vocabulary.thai['1'] as WordEntry[]).map((entry) => ({ ...entry, grade: 1 })), 'thai', false,
  ));

  const randomize = useCallback(() => {
    setResults(pickWords(pool, language));
    setRound((value) => value + 1);
  }, [language, pool]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'generate_vocabulary_set',
      title: 'สุ่มชุดคำศัพท์',
      description: 'สุ่มคำศัพท์พื้นฐาน 20 คำจากไฟล์ต้นฉบับ โดยเลือกภาษาและระดับชั้น พร้อมแบ่งเป็นคำง่าย 7 คำ ปานกลาง 8 คำ และยาก 5 คำ',
      inputSchema: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['thai', 'english'] },
          grade: { anyOf: [{ type: 'integer', minimum: 1, maximum: 6 }, { type: 'string', enum: ['all'] }] },
        },
        required: ['language', 'grade'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as { language?: unknown; grade?: unknown };
        if (value.language !== 'thai' && value.language !== 'english') throw new Error('language ต้องเป็น thai หรือ english');
        const nextGrade = value.grade === 'all' ? 'all' : String(value.grade);
        if (!['1', '2', '3', '4', '5', '6', 'all'].includes(nextGrade)) throw new Error('grade ต้องเป็น 1–6 หรือ all');
        const source = vocabulary[value.language] as Record<string, WordEntry[]>;
        const grades = nextGrade === 'all' ? ['1', '2', '3', '4', '5', '6'] : [nextGrade];
        const nextPool = grades.flatMap((item) => source[item].map((entry) => ({ ...entry, grade: Number(item) })));
        const nextResults = pickWords(nextPool, value.language);
        setLanguage(value.language);
        setGrade(nextGrade);
        setResults(nextResults);
        setRound((current) => current + 1);
        return {
          language: value.language,
          grade: nextGrade,
          total: 20,
          words: {
            easy: nextResults.easy.map((entry) => entry.word),
            medium: nextResults.medium.map((entry) => entry.word),
            hard: nextResults.hard.map((entry) => entry.word),
          },
        };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    setResults(pickWords(pool, language));
    setRound(1);
  }, [language, pool]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[#dfe2ee] bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#625bf6] text-white shadow-[0_7px_20px_rgba(98,91,246,.28)]"><Languages aria-hidden="true" className="size-6" /></div>
            <div><p className="text-[13px] font-bold uppercase tracking-[.14em] text-[#625bf6]">คลังคำพื้นฐาน</p><h1 className="text-xl font-black tracking-tight sm:text-2xl">สุ่มคำศัพท์ ป.1–ป.6</h1></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#e4e6ef] bg-[#f7f8fc] px-4 py-2 text-sm font-semibold text-[#596078] sm:flex"><BookOpen className="size-4 text-[#625bf6]" />จากบัญชีคำศัพท์ที่แนบมา</div>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <div className="mb-7 grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#625bf6]"><Sparkles className="size-4" /> ชุดที่ {round}</div>
            <h2 className="max-w-3xl text-3xl font-black leading-[1.15] tracking-tight sm:text-5xl">เลือกชั้น แล้วรับคำศัพท์<span className="ml-2 inline-block text-[#f08a20]">20 คำ</span></h2>
          </div>
          <div className="grid grid-cols-3 gap-2 self-end" aria-label="สัดส่วนคำศัพท์">
            {DIFFICULTIES.map((item) => <div key={item.key} className={`min-w-[88px] rounded-2xl border px-3 py-2.5 text-center ${item.tone}`}><strong className="block text-2xl font-black leading-none">{item.count}</strong><span className="text-xs font-bold text-[#656b80]">{item.title}</span></div>)}
          </div>
        </div>

        <div className="controls-panel mb-8 grid gap-5 rounded-[26px] border border-[#dfe2ee] bg-white p-4 shadow-[0_18px_55px_rgba(32,38,71,.08)] sm:p-6 lg:grid-cols-[auto_auto_1fr_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#52596e]">ภาษา</label>
            <Tabs value={language} onValueChange={(value) => setLanguage(value as Language)}><TabsList className="h-11 w-full bg-[#f0f1f7] p-1 lg:w-[240px]"><TabsTrigger value="thai" className="h-9 rounded-lg px-4">ภาษาไทย</TabsTrigger><TabsTrigger value="english" className="h-9 rounded-lg px-4">English</TabsTrigger></TabsList></Tabs>
          </div>
          <div>
            <label htmlFor="grade-select" className="mb-2 block text-sm font-bold text-[#52596e]">ระดับชั้น</label>
            <Select value={grade} onValueChange={(value) => setGrade(String(value))}><SelectTrigger id="grade-select" className="h-11 w-full min-w-[190px] rounded-xl border-[#dfe2ee] bg-white px-4 text-base font-bold"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6].map((item) => <SelectItem key={item} value={String(item)}>ประถมศึกษาปีที่ {item}</SelectItem>)}<SelectItem value="all">รวม ป.1–ป.6</SelectItem></SelectContent></Select>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <div className="flex items-center gap-3"><span className="text-sm font-bold text-[#52596e]">มุมมอง</span><Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}><TabsList className="h-11 bg-[#f0f1f7] p-1"><TabsTrigger value="cards" className="h-9 px-3" aria-label="มุมมองการ์ด"><Grid2X2 className="size-4" /> การ์ด</TabsTrigger><TabsTrigger value="list" className="h-9 px-3" aria-label="มุมมองรายการ"><List className="size-4" /> รายการ</TabsTrigger></TabsList></Tabs></div>
            {language === 'english' && <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#52596e]"><Switch checked={showMeaning} onCheckedChange={setShowMeaning} />แสดงคำแปล</label>}
          </div>
          <Button onClick={randomize} size="lg" className="h-12 rounded-xl bg-[#625bf6] px-6 text-base font-black shadow-[0_9px_22px_rgba(98,91,246,.3)] hover:bg-[#5149e8]"><Dices className="size-5" /> สุ่มคำใหม่</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[7fr_8fr_5fr]">
          {DIFFICULTIES.map((section) => (
            <section key={section.key} className={`overflow-hidden rounded-[24px] border ${section.tone}`}>
              <header className="flex items-center justify-between gap-3 border-b border-current/10 px-5 py-4"><div className="flex items-center gap-3"><span className={`size-3 rounded-full ${section.dot}`} /><div><h3 className="text-lg font-black">{section.title}</h3><p className="text-xs font-semibold text-[#73798d]">{section.subtitle}</p></div></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-[#53596c]">{section.count} คำ</span></header>
              <ol className={view === 'cards' ? 'grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2' : 'divide-y divide-black/5 px-5 py-2'}>
                {results[section.key].map((entry, index) => (
                  <li key={`${language}-${grade}-${section.key}-${entry.id}-${entry.grade}`} className={view === 'cards' ? 'word-card group relative min-h-28 rounded-2xl border border-white/90 bg-white p-4 shadow-[0_7px_22px_rgba(38,46,82,.07)]' : 'flex min-h-14 items-center gap-3 py-3'}>
                    <span className={view === 'cards' ? 'mb-4 grid size-7 place-items-center rounded-lg bg-[#eef0f8] text-xs font-black text-[#646b80]' : 'grid size-7 shrink-0 place-items-center rounded-lg bg-white/80 text-xs font-black text-[#646b80]'}>{index + 1}</span>
                    <div><p className={`${language === 'english' ? 'font-sans' : ''} text-[1.35rem] font-black leading-tight tracking-tight`}>{entry.word}</p>{language === 'english' && showMeaning && entry.meaning && <p className="mt-1 text-sm font-semibold text-[#6c7286]">{entry.meaning}</p>}{grade === 'all' && <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[#8c91a2]">ป.{entry.grade} • ลำดับ {entry.id}</p>}</div>
                    {view === 'cards' && <Check className="absolute right-4 top-4 size-4 text-[#c6cad6] transition-colors group-hover:text-[#625bf6]" />}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <footer className="mt-7 flex justify-end border-t border-[#dfe2ee] pt-5 text-sm text-[#6b7184]"><button onClick={randomize} className="inline-flex items-center gap-2 font-black text-[#625bf6] transition hover:text-[#443cdb]"><RefreshCw className="size-4" /> สุ่มอีกครั้ง</button></footer>
      </section>
    </main>
  );
}
