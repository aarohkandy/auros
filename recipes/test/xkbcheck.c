/* xkbcheck — does this keyboard configuration compile, in the library the compositor uses?
 *
 *   xkbcheck LAYOUT VARIANT OPTIONS     exit 0 if it compiles, 1 if it does not
 *
 * src/aurwl builds its keymap with xkb_keymap_new_from_names() from /etc/default/keyboard, which
 * build/forge writes from a profile's keyboard_layout, keyboard_variant and keyboard_options. When
 * the names do not compile, aurwl falls back to a US keyboard and says so in a log nobody reads --
 * so a recipe whose second script named a variant that does not exist would build, boot, and type
 * English. recipes/test/keyboard.test.mjs runs this over every compiled example.
 *
 * Built by that test with: cc -o xkbcheck xkbcheck.c $(pkg-config --cflags --libs xkbcommon)
 */
#include <stdio.h>
#include <xkbcommon/xkbcommon.h>

int main(int argc, char **argv)
{
    if (argc != 4) { fprintf(stderr, "usage: xkbcheck LAYOUT VARIANT OPTIONS\n"); return 2; }
    struct xkb_context *ctx = xkb_context_new(XKB_CONTEXT_NO_FLAGS);
    if (!ctx) { fprintf(stderr, "xkbcheck: no xkb context\n"); return 2; }
    xkb_context_set_log_level(ctx, XKB_LOG_LEVEL_CRITICAL);
    struct xkb_rule_names names = { .rules = "evdev", .model = "pc105",
        .layout = argv[1], .variant = *argv[2] ? argv[2] : NULL, .options = *argv[3] ? argv[3] : NULL };
    struct xkb_keymap *km = xkb_keymap_new_from_names(ctx, &names, XKB_KEYMAP_COMPILE_NO_FLAGS);
    if (!km) { printf("does not compile: layout=%s variant=%s options=%s\n", argv[1], argv[2], argv[3]); xkb_context_unref(ctx); return 1; }
    printf("%u layout(s)\n", xkb_keymap_num_layouts(km));
    xkb_keymap_unref(km);
    xkb_context_unref(ctx);
    return 0;
}
