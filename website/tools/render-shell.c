/* render-shell — one archetype, one theme, one PNG, at a real size.
 *
 * The website's desktop pictures are not mockups: they are what
 * src/aurshell paints, through the same layout code, the same theme
 * loader, the same wallpaper renderer and the same TrueType rasteriser
 * the desktop uses. This is tools/contactsheet.c cut down to one tile,
 * with an archetype read from shells/*.shell and a scale factor so a
 * picture can be made at 2x (geometry doubled in the conf by
 * render-shells.sh; text doubled here through text_scale, which is the
 * shell's own "make everything bigger" setting).
 *
 *   cc -O2 -std=gnu11 -o render-shell website/tools/render-shell.c \
 *      src/aurshell/draw.c src/aurshell/shellcommon.c src/aurshell/anim.c \
 *      src/aurshell/layouts/*.c src/common/theme.c src/common/wall.c \
 *      src/common/font.c src/common/png.c -lm
 * Built with -DWITH_WELCOME (and src/aurshell/welcome.c + foot.c, and
 * WELCOME_STATE / WELCOME_FOUND pointing at files render-shells.sh
 * writes) it also paints the first-start question over the desktop.
 *
 *   render-shell <shell.conf> <x.shell> <out.png> W H [scale] [open]
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../src/aurshell/shell.h"
#include "../../src/common/wall.h"
#include "../../src/common/png.h"
#ifdef WITH_WELCOME
#include "../../src/aurshell/welcome.h"
#endif

int main(int argc, char **argv)
{
    if (argc < 6) {
        fprintf(stderr, "usage: render-shell <shell.conf> <x.shell> <out.png> W H [scale] [open]\n");
        return 2;
    }
    int W = atoi(argv[4]), H = atoi(argv[5]);
    float k = argc > 6 ? (float)atof(argv[6]) : 1.f;
    int nopen = argc > 7 ? atoi(argv[7]) : 3;

    theme_t t = {0};
    if (theme_load(&t, argv[1]) < 0) { fprintf(stderr, "cannot read %s\n", argv[1]); return 1; }

    shell_ctx c;
    memset(&c, 0, sizeof c);
    shell_theme_load(&c, &t);
    shell_seed_apps(&c);
    if (shell_archetype_load(&c, argv[2]) < 0) { fprintf(stderr, "no shell %s\n", argv[2]); return 1; }
    c.allow_install = c.allow_settings = c.allow_theme_change = c.allow_tty = 1;
    c.screen_w = W; c.screen_h = H;
    c.hover = -1;
    c.text_scale = k;
    for (int i = 0; i < nopen && i < SHELL_MAX_WINS; i++) {
        c.wins[i].app = i % c.n_apps;
        snprintf(c.wins[i].title, sizeof c.wins[i].title, "%s", c.apps[c.wins[i].app].name);
        snprintf(c.wins[i].subtitle, sizeof c.wins[i].subtitle, "%s", c.apps[c.wins[i].app].hint);
        c.n_wins++;
    }
    c.focus = nopen ? 0 : -1;
    c.mouse_x = c.mouse_y = -10000;

    const shell_layout *L = shell_layout_by_id(c.layout_id);
    if (L->init) L->init(&c);

    surface *s = surface_new(W, H), *wall = surface_new(W, H);
    uint32_t *tmp = malloc((size_t)W * H * sizeof *tmp);
    if (!s || !wall || !tmp) { fprintf(stderr, "out of memory\n"); return 1; }
    wall_render(tmp, W, H, &t);
    for (int i = 0; i < W * H; i++) wall->px[i] = 0xFF000000u | tmp[i];

    shell_fonts f = {0};
    shell_fonts_load(&f, &c);
    L->paint(&c, s, &f, wall);
#ifdef WITH_WELCOME
    /* the first-start question, exactly as welcome.c paints it */
    if (welcome_init(&c)) welcome_paint(&c, s, &f);
    else fprintf(stderr, "welcome: the question is not open (state file?)\n");
#endif
    if (L->fini) L->fini(&c);

    for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++)
            tmp[(size_t)y * W + x] = s->px[(size_t)y * s->stride + x] & 0xFFFFFFu;
    int rc = png_write_rgb(argv[3], tmp, W, H);
    fprintf(stderr, "%s  %dx%d  layout=%s theme=%s scale=%.2f\n", argv[3], W, H,
            c.layout_id, theme_str(&t, "theme_name", "?"), k);
    free(tmp); surface_free(s); surface_free(wall); shell_fonts_free(&f);
    return rc;
}
