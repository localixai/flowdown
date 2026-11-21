#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINE 1024

/* Counts the lines of a file that contain a word. */
static int count_matches(FILE *file, const char *word) {
    char line[MAX_LINE];
    int count = 0;
    while (fgets(line, sizeof line, file) != NULL) {
        if (strstr(line, word) != NULL) {
            count++;
        }
    }
    return count;
}

int main(int argc, char **argv) {
    if (argc != 3) {
        fprintf(stderr, "usage: %s <word> <file>\n", argv[0]);
        return EXIT_FAILURE;
    }
    FILE *file = fopen(argv[2], "r");
    if (!file) {
        perror("fopen");
        return EXIT_FAILURE;
    }
    printf("%d\n", count_matches(file, argv[1]));
    fclose(file);
    return 0;
}
