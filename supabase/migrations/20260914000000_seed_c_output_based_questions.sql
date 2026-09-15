-- Add the question_type column in case the earlier output-question migration
-- was never applied to this database.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'multiple_choice';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_question_type_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_question_type_check
      CHECK (question_type IN ('multiple_choice', 'output'));
  END IF;
END $$;

-- Seed C output-based questions idempotently (skip rows that already exist so
-- re-applying never creates duplicates). The correct answer stays hidden
-- server-side via correct_answer.
INSERT INTO public.questions (question_text, code_block, options, correct_answer, explanation, difficulty, tags, question_type)
SELECT v.question_text, v.code_block, v.options, v.correct_answer, v.explanation, v.difficulty, v.tags, v.question_type
FROM (VALUES
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 10 / 3);
    return 0;
}$$,
  '["3", "3.333", "3.0", "4"]'::jsonb, 0,
  'Integer division in C truncates the fractional part, so 10 / 3 evaluates to 3.',
  'easy', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", -7 % 2);
    return 0;
}$$,
  '["1", "-2", "-1", "0"]'::jsonb, 2,
  'In C the result of % takes the sign of the dividend, so -7 % 2 is -1 (not 1).',
  'medium', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 5;
    int y = x++;
    printf("%d %d", x, y);
    return 0;
}$$,
  '["5 6", "6 5", "5 5", "6 6"]'::jsonb, 1,
  'x++ yields the old value 5 into y and then increments x to 6, so the output is 6 5.',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int arr[] = {10, 20, 30, 40};
    printf("%d", sizeof(arr) / sizeof(arr[0]));
    return 0;
}$$,
  '["16", "4", "1", "2"]'::jsonb, 1,
  'sizeof(arr) / sizeof(arr[0]) is the standard way to get the element count: 16 / 4 = 4.',
  'easy', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char c = 'A';
    printf("%c", c + 1);
    return 0;
}$$,
  '["A", "B", "66", "C"]'::jsonb, 1,
  'Characters are integers: A has ASCII 65, so 65 + 1 is 66, printed as %c gives B.',
  'easy', ARRAY['output','c','char'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a = 5;
    int *p = &a;
    *p = 10;
    printf("%d", a);
    return 0;
}$$,
  '["5", "11", "garbage value", "10"]'::jsonb, 3,
  'p points to a, and writing through the pointer (*p = 10) modifies a itself.',
  'medium', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 5;
    printf("%d", (x++, x));
    return 0;
}$$,
  '["7", "5", "6", "0"]'::jsonb, 2,
  'The comma operator evaluates x++ first (x becomes 6), then yields the value of x, which is 6.',
  'hard', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 5 > 3 && 2 < 4);
    return 0;
}$$,
  '["0", "1", "true", "8"]'::jsonb, 1,
  'Both comparisons are true, so the logical AND yields 1.',
  'easy', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 7;
    printf("%d", x % 2 ? x * 2 : x / 2);
    return 0;
}$$,
  '["7", "3", "14", "21"]'::jsonb, 2,
  '7 % 2 is 1 (truthy), so the ternary takes the first branch and prints 7 * 2 = 14.',
  'medium', ARRAY['output','c','ternary'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char s[] = "abc";
    printf("%d", sizeof(s));
    return 0;
}$$,
  '["3", "5", "4", "0"]'::jsonb, 2,
  'sizeof includes the terminating null character, so "abc" stored in an array occupies 4 bytes.',
  'easy', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int fact(int n) {
    return n <= 1 ? 1 : n * fact(n - 1);
}
int main() {
    printf("%d", fact(5));
    return 0;
}$$,
  '["15", "120", "25", "100"]'::jsonb, 1,
  'This is a recursive factorial, so fact(5) = 5 * 4 * 3 * 2 * 1 = 120.',
  'easy', ARRAY['output','c','recursion'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 5 & 3);
    return 0;
}$$,
  '["7", "8", "0", "1"]'::jsonb, 3,
  'Bitwise AND: 101 & 011 = 001, which is 1 in decimal.',
  'medium', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 2;
    switch (x) {
        case 1:
            printf("one");
        case 2:
            printf("two");
        case 3:
            printf("three");
    }
    return 0;
}$$,
  '["two", "twothree", "three", "one"]'::jsonb, 1,
  'Without break statements, execution falls through from case 2, so both "two" and "three" print.',
  'hard', ARRAY['output','c','switch'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int arr[] = {10, 20, 30};
    int *p = arr;
    printf("%d", *(p + 2));
    return 0;
}$$,
  '["20", "10", "30", "garbage value"]'::jsonb, 2,
  'Pointer arithmetic scales by element size: p + 2 points to the third element, 30.',
  'medium', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
void func() {
    static int count = 0;
    count++;
    printf("%d ", count);
}
int main() {
    func();
    func();
    func();
    return 0;
}$$,
  '["1 2 3", "1 1 1", "3 3 3", "3 2 1"]'::jsonb, 0,
  'A static local variable keeps its value between calls, so count increments across the three calls.',
  'hard', ARRAY['output','c','static'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
#define SQUARE(x) x * x
int main() {
    printf("%d", SQUARE(2 + 3));
    return 0;
}$$,
  '["25", "10", "11", "13"]'::jsonb, 2,
  'SQUARE is expanded textually to 2 + 3 * 2 + 3 = 2 + 6 + 3 = 11, not (5 * 5).',
  'hard', ARRAY['output','c','macro'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    float f = 3.7;
    printf("%d", (int)f);
    return 0;
}$$,
  '["4", "3", "3.7", "3.0"]'::jsonb, 1,
  'Casting a float to int truncates toward zero, so 3.7 becomes 3.',
  'easy', ARRAY['output','c','casting'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i = 0;
    do {
        i++;
    } while (i < 3);
    printf("%d", i);
    return 0;
}$$,
  '["2", "1", "4", "3"]'::jsonb, 3,
  'The do-while body runs until i reaches 3, at which point the condition i < 3 is false.',
  'medium', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 1 << 4);
    return 0;
}$$,
  '["8", "32", "16", "4"]'::jsonb, 2,
  'Shifting 1 left by 4 places multiplies by 2 four times: 2^4 = 16.',
  'easy', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
#include <string.h>
int main() {
    char a[] = "abc";
    char b[] = "abc";
    printf("%d", strcmp(a, b));
    return 0;
}$$,
  '["1", "-1", "0", "true"]'::jsonb, 2,
  'strcmp returns 0 when both strings are identical, which is the convention for equality.',
  'medium', ARRAY['output','c','strings'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
void change(int n) {
    n = 100;
}
int main() {
    int a = 10;
    change(a);
    printf("%d", a);
    return 0;
}$$,
  '["100", "110", "0", "10"]'::jsonb, 3,
  'C is pass-by-value, so change() modifies a copy and the original a stays 10.',
  'medium', ARRAY['output','c','functions'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 8 >> 2);
    return 0;
}$$,
  '["4", "1", "2", "16"]'::jsonb, 2,
  'Right shift divides by powers of two: 8 shifted right twice is 8 / 4 = 2.',
  'easy', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i, j;
    for (i = 1; i <= 3; i++) {
        for (j = 1; j <= i; j++) {
            printf("%d", j);
        }
    }
    return 0;
}$$,
  '["112123", "123123", "112233", "123"]'::jsonb, 0,
  'The outer loop prints 1, then 12, then 123, which concatenate to 112123.',
  'hard', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", ~0);
    return 0;
}$$,
  '["0", "1", "-1", "2"]'::jsonb, 2,
  'Bitwise NOT flips every bit; in two''s complement ~0 equals -1.',
  'medium', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
void print(int n) {
    if (n == 0) return;
    print(n - 1);
    printf("%d", n);
}
int main() {
    print(3);
    return 0;
}$$,
  '["321", "123", "012", "111"]'::jsonb, 1,
  'The recursive calls unwind first, so n is printed in ascending order: 1, 2, 3.',
  'medium', ARRAY['output','c','recursion'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char s[] = {'j', 'c', '\0'};
    printf("%d", sizeof(s));
    return 0;
}$$,
  '["2", "3", "4", "1"]'::jsonb, 1,
  'sizeof counts the three characters including the explicit null terminator.',
  'easy', ARRAY['output','c'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a = 0, b = 5;
    printf("%d", a && b);
    return 0;
}$$,
  '["1", "5", "0", "undefined"]'::jsonb, 2,
  'Logical AND short-circuits: since a is 0, b is never evaluated and the result is 0.',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i = 1;
    while (i < 10) {
        i *= 2;
    }
    printf("%d", i);
    return 0;
}$$,
  '["8", "10", "16", "32"]'::jsonb, 2,
  'Doubling i gives 2, 4, 8, then 16, at which point 16 < 10 is false and the loop stops.',
  'medium', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a[] = {1, 2, 3, 4, 5};
    printf("%d", a[5 - 2]);
    return 0;
}$$,
  '["3", "4", "5", "2"]'::jsonb, 1,
  'Array indices start at 0, so a[3] is the fourth element, 4.',
  'easy', ARRAY['output','c','arrays'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char c = 'B';
    printf("%d", c);
    return 0;
}$$,
  '["66", "B", "65", "67"]'::jsonb, 0,
  'Printing a char with %d shows its ASCII value; B is 66.',
  'easy', ARRAY['output','c','char'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 7;
    int *p = &x;
    int **pp = &p;
    printf("%d", **pp);
    return 0;
}$$,
  '["7", "8", "address of x", "garbage value"]'::jsonb, 0,
  'pp points to p which points to x, so **pp dereferences twice to reach 7.',
  'medium', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i;
    for (i = 3; i > 0; i--) {
        printf("%d", i);
    }
    return 0;
}$$,
  '["123", "321", "333", "0123"]'::jsonb, 1,
  'The loop runs with i equal to 3, 2 and 1 in that order.',
  'easy', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int fib(int n) {
    return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
int main() {
    printf("%d", fib(6));
    return 0;
}$$,
  '["8", "6", "9", "13"]'::jsonb, 0,
  'The Fibonacci sequence is 0, 1, 1, 2, 3, 5, 8, so fib(6) is 8.',
  'medium', ARRAY['output','c','recursion'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a[2] = {5, 10};
    a[1] = a[0] * 2;
    printf("%d %d", a[0], a[1]);
    return 0;
}$$,
  '["10 5", "5 10", "5 5", "10 10"]'::jsonb, 1,
  'a[1] is reassigned to 5 * 2 = 10, while a[0] stays 5, so the output is 5 10.',
  'easy', ARRAY['output','c','arrays'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 0;
    printf("%d", 1 || x++);
    return 0;
}$$,
  '["1", "0", "2", "undefined"]'::jsonb, 0,
  'Logical OR short-circuits on a true left operand, so x++ never runs and 1 is printed.',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 7 + 3 * 2);
    return 0;
}$$,
  '["20", "10", "16", "13"]'::jsonb, 3,
  'Multiplication binds tighter than addition, so this is 7 + 6 = 13.',
  'easy', ARRAY['output','c','precedence'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char *s = "Hello";
    printf("%c", s[1]);
    return 0;
}$$,
  '["H", "e", "l", "o"]'::jsonb, 1,
  'String indexing starts at 0, so s[1] is the second character, e.',
  'easy', ARRAY['output','c','strings'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    unsigned int x = 0;
    x--;
    printf("%u", x);
    return 0;
}$$,
  '["-1", "0", "4294967295", "1"]'::jsonb, 2,
  'Unsigned integers wrap around: subtracting 1 from 0 gives the maximum value 2^32 - 1.',
  'hard', ARRAY['output','c','unsigned'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int add(int a, int b) {
    return a + b;
}
int main() {
    printf("%d", add(2, 3) * 2);
    return 0;
}$$,
  '["10", "5", "12", "6"]'::jsonb, 0,
  'add returns 5, and 5 * 2 = 10 is printed.',
  'easy', ARRAY['output','c','functions'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 10;
    int y = --x;
    printf("%d %d", x, y);
    return 0;
}$$,
  '["9 9", "9 10", "10 9", "10 10"]'::jsonb, 0,
  'The prefix decrement reduces x to 9 first, so both x and y become 9.',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 10;
    printf("%d", x > 5 ? (x > 8 ? 1 : 2) : 3);
    return 0;
}$$,
  '["1", "2", "3", "10"]'::jsonb, 0,
  'x > 5 is true, then the inner check x > 8 is also true, so 1 is printed.',
  'medium', ARRAY['output','c','ternary'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 5 ^ 3);
    return 0;
}$$,
  '["6", "7", "1", "8"]'::jsonb, 0,
  'Bitwise XOR: 101 ^ 011 = 110, which is 6 in decimal.',
  'medium', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", 5 | 3);
    return 0;
}$$,
  '["1", "7", "6", "2"]'::jsonb, 1,
  'Bitwise OR: 101 | 011 = 111, which is 7 in decimal.',
  'medium', ARRAY['output','c','bitwise'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int x = 20;
int main() {
    int x = 10;
    printf("%d", x);
    return 0;
}$$,
  '["10", "20", "30", "0"]'::jsonb, 0,
  'The local variable x shadows the global x, so 10 is printed.',
  'easy', ARRAY['output','c','scoping'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d", printf("hi"));
    return 0;
}$$,
  '["hi2", "2", "hi", "compile error"]'::jsonb, 0,
  'printf returns the number of characters written, so the inner call prints hi and returns 2.',
  'hard', ARRAY['output','c','printf'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
enum Color { RED, GREEN = 5, BLUE };
int main() {
    printf("%d", BLUE);
    return 0;
}$$,
  '["2", "5", "6", "0"]'::jsonb, 2,
  'RED is 0, GREEN is explicitly 5, and BLUE continues to 6.',
  'medium', ARRAY['output','c','enum'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i = 0;
    while (++i < 4) {
        printf("%d", i);
    }
    return 0;
}$$,
  '["0123", "123", "1234", "01234"]'::jsonb, 1,
  'The prefix increment makes i 1, 2, 3 before each comparison, printing each; i reaches 4 and stops.',
  'medium', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i;
    for (i = 1; i <= 5; i++) {
        if (i == 3) break;
        printf("%d", i);
    }
    return 0;
}$$,
  '["123", "12", "12345", "1245"]'::jsonb, 1,
  'break exits the loop as soon as i reaches 3, so only 1 and 2 are printed.',
  'easy', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i;
    for (i = 1; i <= 5; i++) {
        if (i == 3) continue;
        printf("%d", i);
    }
    return 0;
}$$,
  '["12345", "1235", "1245", "12"]'::jsonb, 2,
  'continue skips only the body for i == 3, giving 1245.',
  'medium', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a[] = {10, 20};
    int *p = a;
    printf("%d", *++p);
    return 0;
}$$,
  '["20", "10", "11", "21"]'::jsonb, 0,
  'The prefix increment moves p to the second element first, then it is dereferenced to 20.',
  'hard', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a[] = {10, 20};
    int *p = a;
    printf("%d", ++*p);
    return 0;
}$$,
  '["21", "11", "10", "20"]'::jsonb, 1,
  'The increment applies to the pointed value: a[0] becomes 11, and 11 is printed.',
  'hard', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i, j;
    for (i = 1, j = 5; i < j; i++, j--);
    printf("%d", i + j);
    return 0;
}$$,
  '["6", "5", "10", "4"]'::jsonb, 0,
  'The loop ends when i and j meet at 3, so i + j = 6.',
  'hard', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int count = 0;
void increment() {
    count++;
}
int main() {
    increment();
    increment();
    increment();
    printf("%d", count);
    return 0;
}$$,
  '["3", "0", "1", "2"]'::jsonb, 0,
  'Global variables are shared across functions, so the global count ends at 3.',
  'easy', ARRAY['output','c','globals'], 'output'
)
) AS v(question_text, code_block, options, correct_answer, explanation, difficulty, tags, question_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.questions q
  WHERE q.question_text = v.question_text
    AND q.code_block = v.code_block
    AND q.question_type = v.question_type
);