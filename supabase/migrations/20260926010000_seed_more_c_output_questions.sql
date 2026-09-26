-- Additional C output-prediction questions.
--
-- These are deliberately distinct from 20260914000000_seed_c_output_based_questions.sql
-- and from the five C questions already used by the live contests: that seed
-- already covers integer/float division, modulo sign, swap, post/pre increment,
-- shift and XOR/OR masking, sizeof, string.h, recursion, pointers, do-while,
-- short-circuit evaluation, comma operator, enums and function-like macros.
--
-- Topics below are new: storage duration, char signedness, integer overflow
-- wraparound, struct layout/padding, function pointers, static vs extern,
-- compound assignment, comma in declarations, const/restrict, bitwise negation
-- of unsigned, array decay, multi-dimensional indexing, char array vs pointer,
-- and evaluation order of function arguments.
--
-- Seeded idempotently: rows that already exist (same question_text, code_block
-- and question_type) are skipped, so re-applying never creates duplicates.
-- The answer key stays server-side in correct_answer.

INSERT INTO public.questions (question_text, code_block, options, correct_answer, explanation, difficulty, tags, question_type)
SELECT v.question_text, v.code_block, v.options, v.correct_answer, v.explanation, v.difficulty, v.tags, v.question_type
FROM (VALUES
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    printf("%d %d", 8 / 2 * 2, 8 % 2 * 2);
    return 0;
}$$,
  '["8 0", "4 0", "8 4", "0 4"]'::jsonb, 0,
  'Operators of equal precedence associate left to right, so 8 / 2 * 2 is (8 / 2) * 2 = 8, and 8 % 2 is 0 so the second value is 0.',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int a[3] = {1, 2, 3};
    int *p = a;
    printf("%d %d", *(p + 1), p[2]);
    return 0;
}$$,
  '["2 3", "3 2", "1 3", "2 1"]'::jsonb, 0,
  'Pointer arithmetic on p + 1 reaches the second element, and p[2] is the third, so 2 and 3 are printed.',
  'easy', ARRAY['output','c','pointers'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char c = 'A';
    c += 1;
    printf("%c", c);
    return 0;
}$$,
  '["A", "B", "C", "compile error"]'::jsonb, 1,
  'Characters are stored as their ASCII codes, so incrementing ''A'' (65) gives 66, which is ''B''.',
  'easy', ARRAY['output','c','char'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 5;
    x *= 3;
    x -= 4;
    x /= 3;
    printf("%d", x);
    return 0;
}$$,
  '["1", "3", "4", "11"]'::jsonb, 1,
  'The compound assignments apply left to right: 5 * 3 = 15, 15 - 4 = 11, 11 / 3 = 3 (integer division).',
  'medium', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i = 0, j = 0;
    for (i = 0; i < 3; i++) {
        for (j = 0; j < 2; j++) {
            if (j == 1) break;
        }
    }
    printf("%d %d", i, j);
    return 0;
}$$,
  '["3 2", "3 1", "2 2", "2 1"]'::jsonb, 1,
  'The inner loop breaks with j = 1, then j is reset to 0 on every outer iteration. The outer loop runs three times so i ends at 3 and j at 1.',
  'hard', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
struct Point { int x; char c; };
int main() {
    printf("%d", (int)sizeof(struct Point));
    return 0;
}$$,
  '["4", "5", "8", "compile error"]'::jsonb, 2,
  'The int takes 4 bytes and the char 1, but the struct is padded so the char can sit inside the int''s alignment, giving 8 bytes on a typical 64-bit system.',
  'hard', ARRAY['output','c','struct'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 1;
    x += x += 3;
    printf("%d", x);
    return 0;
}$$,
  '["8", "5", "6", "compile error"]'::jsonb, 0,
  'Compound assignment evaluates its left operand once, so the inner x += 3 raises x to 4 and the outer addition then stores 4 + 4 = 8.',
  'hard', ARRAY['output','c','operators'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int square(int n) { return n * n; }
int main() {
    int (*fp)(int) = square;
    printf("%d", fp(5));
    return 0;
}$$,
  '["10", "25", "0", "compile error"]'::jsonb, 1,
  'fp points at the function square, so fp(5) calls it normally and returns 25.',
  'medium', ARRAY['output','c','functions'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int counter(void) {
    static int n = 0;
    n++;
    return n;
}
int main() {
    counter();
    printf("%d", counter());
    return 0;
}$$,
  '["1", "2", "3", "0"]'::jsonb, 1,
  'A static local keeps its value between calls, so the first call leaves n at 1 and the second returns 2.',
  'medium', ARRAY['output','c','storage'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    unsigned char c = 200;
    c = c + 100;
    printf("%d", c);
    return 0;
}$$,
  '["300", "44", "0", "compile error"]'::jsonb, 1,
  'An unsigned char holds 0-255, so 300 wraps around modulo 256 to 44.',
  'medium', ARRAY['output','c','types'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int m[2][3] = {{1, 2, 3}, {4, 5, 6}};
    printf("%d", m[1][2]);
    return 0;
}$$,
  '["6", "3", "4", "compile error"]'::jsonb, 0,
  'The first index selects the second row and the second index its third element, which is 6.',
  'easy', ARRAY['output','c','arrays'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int arr[4] = {10, 20, 30, 40};
    int *p = arr + 3;
    printf("%d %d", *p, *(p - 1));
    return 0;
}$$,
  '["40 30", "30 40", "40 40", "10 40"]'::jsonb, 0,
  'p points at the last element, so *p is 40 and *(p - 1) steps back one element to 30.',
  'easy', ARRAY['output','c','pointers'], 'output'
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
  '["4294967295", "0", "-1", "compile error"]'::jsonb, 0,
  'Decrementing an unsigned 0 wraps around to the maximum value, which is 4294967295 on a 32-bit int.',
  'hard', ARRAY['output','c','types'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int x = 10;
    if (x = 5) {
        printf("%d", x);
    }
    return 0;
}$$,
  '["5", "10", "0", "compile error"]'::jsonb, 0,
  'A single = is assignment, not comparison, so x becomes 5 which is truthy and 5 is printed.',
  'easy', ARRAY['output','c','conditionals'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    const int n = 4;
    int v[n];
    for (int i = 0; i < n; i++) v[i] = i * i;
    printf("%d", v[3]);
    return 0;
}$$,
  '["9", "3", "12", "compile error"]'::jsonb, 0,
  'A const int with a constant initialiser is a constant expression in C, so the array has 4 elements and v[3] is 3 squared, 9.',
  'medium', ARRAY['output','c','arrays'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int i = 0;
    while (i < 3) {
        i++;
        if (i == 2) continue;
        printf("%d", i);
    }
    return 0;
}$$,
  '["13", "123", "12", "3"]'::jsonb, 0,
  'continue skips the print on the iteration where i is 2, so only 1 and 3 are printed, giving 13.',
  'medium', ARRAY['output','c','loops'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    char s[] = "hi";
    printf("%d", (int)sizeof(s));
    return 0;
}$$,
  '["3", "2", "4", "compile error"]'::jsonb, 0,
  'A char array initialised from a string literal includes the terminating null byte, so it occupies 3 bytes.',
  'medium', ARRAY['output','c','arrays'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
void greet(void) { printf("A"); }
int main() {
    greet();
    greet();
    return 0;
}$$,
  '["AA", "A", "A A", "compile error"]'::jsonb, 0,
  'The function is called twice and each call prints A, so the output is AA.',
  'easy', ARRAY['output','c','functions'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int n = 5;
    switch (n) {
        case 1:
        case 2:
            printf("low");
            break;
        case 5:
            printf("five");
        default:
            printf("!");
    }
    return 0;
}$$,
  '["five!", "low!", "five", "!"]'::jsonb, 0,
  'n matches case 5, which prints five but has no break, so execution falls through to default and prints the exclamation mark.',
  'medium', ARRAY['output','c','switch'], 'output'
),
(
  'What is printed?',
  $$#include <stdio.h>
int main() {
    int total = 0;
    int values[5] = {1, 2, 3, 4, 5};
    for (int i = 0; i < 5; i += 2) {
        total += values[i];
    }
    printf("%d", total);
    return 0;
}$$,
  '["9", "15", "6", "10"]'::jsonb, 0,
  'i takes the values 0, 2 and 4, so total accumulates 1 + 3 + 5 = 9.',
  'easy', ARRAY['output','c','arrays'], 'output'
)
) AS v(question_text, code_block, options, correct_answer, explanation, difficulty, tags, question_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.questions q
  WHERE q.question_text = v.question_text
    AND q.code_block = v.code_block
    AND q.question_type = v.question_type
);
