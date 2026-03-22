#!/usr/bin/env ts-node
// -*- coding: utf-8 -*-

/** TYPESCRIPT CHEATSHEET */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const VERSION = '1.0';

// ── Types & Interfaces ────────────────────────────────────────────────────────

type StringOrNumber = string | number;         // Union type
type Nullable<T>   = T | null;                 // Generic type alias
type Point         = { x: number; y: number }; // Object type alias

interface Animal {
  name: string;
  age?: number;                                // Optional property
  readonly id: number;                         // Readonly property
  speak(): string;
}

interface Dog extends Animal {                 // Interface extension
  breed: string;
}

// Enum
enum Direction { Up = 'UP', Down = 'DOWN', Left = 'LEFT', Right = 'RIGHT' }

// ── Generic Functions ─────────────────────────────────────────────────────────

function identity<T>(arg: T): T { return arg; }
function first<T>(arr: T[]): T | undefined { return arr[0]; }
function merge<A, B>(a: A, b: B): A & B { return { ...a, ...b } as A & B; }

// ── Utility Types ─────────────────────────────────────────────────────────────

type PartialDog  = Partial<Dog>;               // All props optional
type ReadonlyDog = Readonly<Dog>;              // All props readonly
type DogPreview  = Pick<Dog, 'name' | 'breed'>; // Subset of props
type NoDogId     = Omit<Dog, 'id'>;            // Exclude specific props
type RecordMap   = Record<string, number>;     // Key-value map type

// ── Class ─────────────────────────────────────────────────────────────────────

class MyClass {
  private   secret: string  = 'hidden';
  protected count:  number  = 0;
  public    label:  string;

  // Static property / method
  static instances = 0;
  static create(label: string) { return new MyClass(label); }

  constructor(label: string) {
    this.label = label;
    MyClass.instances++;
  }

  // Getter / Setter
  get info(): string { return `${this.label}:${this.count}`; }
  set value(n: number) { this.count = n > 0 ? n : 0; }

  // Method with default param
  greet(prefix = 'Hello'): string { return `${prefix}, ${this.label}`; }

  stringOps(): void {
    const s      = 'hello world';
    s.toUpperCase();
    s.includes('world');
    s.startsWith('hello');
    s.split(' ');
    s.replace('world', 'ts');
    s.trim();
    s.slice(0, 5);
    const name   = 'TypeScript';
    const tmpl   = `Language: ${name}, length: ${name.length}`; // Template literal
    const multi  = `line one
line two`;
    [tmpl, multi];
  }

  dataStructures(): void {
    // Arrays
    const nums: number[] = [1, 2, 3, 4, 5];
    nums.push(6);
    nums.pop();
    nums.shift();
    nums.unshift(0);
    nums.splice(1, 1);            // Remove 1 elem at index 1
    nums.slice(1, 3);             // [2, 3], non-mutating
    nums.indexOf(3);
    nums.includes(3);
    nums.sort((a, b) => a - b);
    nums.reverse();

    // Array functional ops
    const doubled   = nums.map(n => n * 2);
    const evens     = nums.filter(n => n % 2 === 0);
    const sum       = nums.reduce((acc, n) => acc + n, 0);
    const hasEven   = nums.some(n => n % 2 === 0);
    const allPos    = nums.every(n => n > 0);
    const found     = nums.find(n => n > 3);
    [doubled, evens, sum, hasEven, allPos, found];

    // Tuple
    const pair: [string, number] = ['age', 30];
    const [key, val] = pair;       // Destructuring
    [key, val];

    // Object / Map / Set
    const obj: Record<string, unknown> = { a: 1, b: 'two', c: true };
    const { a, b, ...rest } = obj; // Destructuring + rest
    const copy = { ...obj, d: 4 }; // Spread
    Object.keys(obj);
    Object.values(obj);
    Object.entries(obj).forEach(([k, v]) => { [k, v]; });
    [a, b, rest, copy];

    const map = new Map<string, number>([['x', 1], ['y', 2]]);
    map.set('z', 3);
    map.get('x');
    map.has('y');
    map.delete('z');
    map.size;

    const set = new Set<number>([1, 2, 3, 2, 1]); // Unique: {1,2,3}
    set.add(4);
    set.has(2);
    set.delete(1);
    set.size;
  }

  conditionalsAndLoops(): void {
    const x = 42;

    // Conditionals
    if (x > 100) { /* noop */ } else if (x > 50) { /* noop */ } else { /* noop */ }

    // Nullish coalescing / optional chaining
    const obj: { a?: { b?: number } } = {};
    const val = obj?.a?.b ?? 0;         // Safe nav + fallback
    [val];

    // Switch
    const dir = Direction.Up;
    switch (dir) {
      case Direction.Up:   break;
      case Direction.Down: break;
      default:             break;
    }

    // Loops
    for (let i = 0; i < 5; i++) { /* noop */ }
    for (const n of [1, 2, 3]) { [n]; }       // for-of (values)
    for (const k in { a: 1 })  { [k]; }       // for-in (keys)
    [1, 2, 3].forEach((n, i) => { [n, i]; });

    let i = 0;
    while (i < 3)    { i++; }
    do { i--; } while (i > 0);
  }

  asyncOps(): void {
    // Promise
    const p = new Promise<string>((resolve, reject) => {
      Math.random() > 0.5 ? resolve('ok') : reject(new Error('fail'));
    });
    p.then(v => v).catch(e => e);

    // Async/await (must be in async function)
    const fetchData = async (url: string): Promise<unknown> => {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    // Promise combinators
    Promise.all([fetchData('/a'), fetchData('/b')]);
    Promise.allSettled([fetchData('/a'), fetchData('/b')]);
    Promise.race([fetchData('/a'), fetchData('/b')]);
    [p, fetchData];
  }

  fileAndJson(): void {
    // JSON
    const obj   = { name: 'Alice', scores: [10, 20] };
    const str   = JSON.stringify(obj, null, 2);
    const back  = JSON.parse(str) as typeof obj;
    [str, back];

    // Sync file I/O (Node.js)
    fs.writeFileSync('out.txt', 'hello', 'utf-8');
    const contents = fs.readFileSync('out.txt', 'utf-8');
    fs.existsSync('out.txt');
    fs.unlinkSync('out.txt');

    // Async file I/O
    fs.promises.readFile('out.txt', 'utf-8').then(data => data);
    [contents];

    // Path utilities
    path.join('dir', 'sub', 'file.txt');
    path.basename('/dir/file.txt');          // 'file.txt'
    path.extname('file.ts');                 // '.ts'
    path.resolve('relative/path');
  }

  errorHandling(): void {
    try {
      throw new Error('something went wrong');
    } catch (err) {
      if (err instanceof Error) console.error(err.message);
    } finally {
      // always runs
    }

    // Custom error
    class AppError extends Error {
      constructor(public code: number, message: string) {
        super(message);
        this.name = 'AppError';
      }
    }
    throw new AppError(404, 'not found');
  }

  typeNarrowing(): void {
    const val: StringOrNumber = Math.random() > 0.5 ? 'hi' : 42;

    // typeof guard
    if (typeof val === 'string') val.toUpperCase();
    else val.toFixed(2);

    // instanceof guard
    const e = new Error('test');
    if (e instanceof Error) e.message;

    // Type assertion
    const x = val as string;
    const y = <number>val;           // Alternate assertion syntax
    [x, y];

    // Non-null assertion
    const el = document.getElementById('app')!;
    [el];
  }
}

// ── Decorators (experimental) ─────────────────────────────────────────────────

function log(target: unknown, key: string, desc: PropertyDescriptor) {
  const orig = desc.value;
  desc.value = function (...args: unknown[]) {
    console.log(`Calling ${key}`);
    return orig.apply(this, args);
  };
}

// ── Module pattern (barrel export example) ───────────────────────────────────

export { MyClass, Direction, VERSION };
export type { Animal, Dog, StringOrNumber, Nullable };

// ── Entry point ───────────────────────────────────────────────────────────────

const instance = MyClass.create('drill');
instance.stringOps();
instance.dataStructures();
instance.conditionalsAndLoops();
console.log(instance.info);
console.log(instance.greet());
console.log(`MyClass instances: ${MyClass.instances}`);
