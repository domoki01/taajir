<?php

use App\Enums\Locale;
use App\Http\Controllers\Admin\ArticleController as AdminArticleController;
use App\Http\Controllers\Admin\AuditController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Admin\CommentController as AdminCommentController;
use App\Http\Controllers\Admin\HomeController as AdminHomeController;
use App\Http\Controllers\Admin\LaunchController as AdminLaunchController;
use App\Http\Controllers\Admin\ModerationController;
use App\Http\Controllers\Admin\PromoController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\TaxonomyController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ArticleController as PublicArticleController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\BrowseController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommuneController;
use App\Http\Controllers\Dashboard\ListingController as DashboardListingController;
use App\Http\Controllers\Dashboard\SavedSearchController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\LaunchController;
use App\Http\Controllers\ListingController;
use App\Http\Controllers\PublishController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\StaticPageController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
|
| The URL scheme is the contract with Google and with every WhatsApp message
| ever sent, so every Arabic path here is byte-identical to the one the Next
| app serves. Segments are Latin and French-derived; Arabic never appears in a
| URL.
|
| The same set is registered twice: once behind /fr and /en, and once bare for
| Arabic. Arabic keeps the unprefixed paths because they are the ones already
| indexed and already shared — the two additions are what take a prefix.
|
| Order matters. The prefixed group goes first, because the bare browse
| catch-all would otherwise read /fr/cgu as a transaction type called "fr".
|
*/

$routes = function (): void {
    /*
     * The home page is held too. It renders featured and latest listings, and
     * a hold that left it open would show the whole catalogue through the one
     * URL everybody types — the ads stay `published` while the site is held,
     * so nothing else would be hiding them.
     *
     * The articles are deliberately NOT held: they carry no listings, and they
     * are the one surface worth having indexed before the doors open.
     */
    Route::get('/', HomeController::class)->middleware('launched')->name('home');

    /*
     * The closed door. Outside the launch guard, obviously — it is where the
     * guard sends people.
     */
    Route::get('/lancement', [LaunchController::class, 'show'])->name('launch');
    Route::get('/api/launch-state', [LaunchController::class, 'state'])->name('launch.state');

    Route::get('/recherche', SearchController::class)->middleware('launched')->name('search');

    // The id resolves it; the slug is for humans. A wrong slug 301s to the
    // right one rather than 404ing, so old links keep landing.
    Route::get('/annonce/{id}/{slug}', [ListingController::class, 'show'])
        ->where('id', '[a-z0-9]{12}')
        ->middleware('launched')
        ->name('listing');

    /*
     * The content pages. Listed one by one rather than as `/{page}` so that the
     * browse catch-all cannot resolve `/cgu` as a transaction type and 404 it.
     */
    foreach (['a-propos', 'aide', 'cgu', 'confidentialite', 'securite'] as $page) {
        Route::get("/{$page}", StaticPageController::class)
            ->defaults('page', $page)
            ->name("static.{$page}");
    }

    /*
     * Sign-in. The pages host the Firebase widget; the exchange is what the
     * site actually trusts — see SessionController.
     */
    Route::get('/connexion', [AuthController::class, 'signIn'])->name('sign-in');
    Route::get('/inscription', [AuthController::class, 'signUp'])->name('sign-up');
    Route::post('/auth/session', [SessionController::class, 'store'])->name('session.store');
    Route::delete('/auth/session', [SessionController::class, 'destroy'])->name('session.destroy');

    Route::middleware('auth.session')->group(function () {
        Route::get('/publier', [PublishController::class, 'create'])->name('publish');
        Route::post('/publier', [PublishController::class, 'store'])->name('publish.store');
        Route::get('/merci', [PublishController::class, 'thanks'])->name('thanks');
    });

    /*
     * The masthead. These pages exist for a reason that is not editorial: a
     * classifieds site with nothing but listings has almost no text a search
     * engine can index against a question.
     *
     * Fixed before the catch-all, and /articles/{slug} takes a slug pattern so
     * it cannot swallow the admin editor's own paths.
     */
    Route::get('/articles', [PublicArticleController::class, 'index'])->name('articles');
    Route::get('/articles/{slug}', [PublicArticleController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('articles.show');

    Route::middleware('auth.session')->group(function () {
        Route::post('/articles/{slug}/commentaires', [PublicArticleController::class, 'comment'])
            ->where('slug', '[a-z0-9-]+')
            ->name('articles.comment');
        Route::delete('/articles/commentaires/{comment}', [PublicArticleController::class, 'destroyComment'])
            ->name('articles.comment.destroy');
    });

    /*
     * The demand feed. Reading is open; posting is not.
     */
    Route::get('/demandes', [RequestController::class, 'index'])->middleware('launched')->name('requests');
    Route::get('/demandes/nouvelle', [RequestController::class, 'create'])->middleware('auth.session')->name('requests.create');
    Route::post('/demandes', [RequestController::class, 'store'])->middleware('auth.session')->name('requests.store');
    Route::get('/demandes/{id}', [RequestController::class, 'show'])->middleware('launched')->name('requests.show');
    Route::post('/demandes/{id}/repondre', [RequestController::class, 'reply'])->middleware('auth.session')->name('requests.reply');

    Route::middleware('auth.session')->group(function () {
        Route::post('/annonce/{listing}/commentaires', [CommentController::class, 'store'])->name('comments.store');
        Route::delete('/commentaires/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');

        Route::get('/tableau-de-bord/annonces', [DashboardListingController::class, 'index'])->name('dashboard.listings');
        Route::get('/tableau-de-bord/alertes', [SavedSearchController::class, 'index'])->name('dashboard.alerts');
        Route::post('/tableau-de-bord/alertes', [SavedSearchController::class, 'store'])->name('dashboard.alerts.store');
        Route::delete('/tableau-de-bord/alertes/{savedSearch}', [SavedSearchController::class, 'destroy'])->name('dashboard.alerts.destroy');
    });

    /*
     * The admin section.
     *
     * Two guards on the group and a third inside every action. `staff` only
     * asks whether this account holds any permission at all; each controller
     * asks for the one its screen needs, and asks again at the point of doing
     * the thing rather than once at the door. Reaching a page is never treated
     * as proof of anything — that was true of the Server Actions these replace
     * and it is true of these.
     */
    Route::middleware(['auth.session', 'staff'])->prefix('/admin')->group(function () {
        Route::get('/', AdminHomeController::class)->name('admin');
        Route::get('/journal', AuditController::class)->name('admin.audit');

        /*
         * Accounts. Two permissions reach the screen — users.manage and
         * users.approve — and each action asks for its own inside the service,
         * so a front-desk role that may only approve registrations gets the
         * queue and nothing else.
         */
        Route::get('/utilisateurs', [UserController::class, 'index'])->name('admin.users');
        Route::post('/utilisateurs/approbation', [UserController::class, 'requireApproval'])->name('admin.users.require_approval');
        Route::post('/utilisateurs/{user}/role', [UserController::class, 'role'])->name('admin.users.role');
        Route::post('/utilisateurs/{user}/suspension', [UserController::class, 'ban'])->name('admin.users.ban');
        Route::post('/utilisateurs/{user}/quota', [UserController::class, 'quota'])->name('admin.users.quota');
        Route::post('/utilisateurs/{user}/approbation', [UserController::class, 'approve'])->name('admin.users.approve');

        Route::get('/roles', [RoleController::class, 'index'])->name('admin.roles');
        Route::post('/roles', [RoleController::class, 'save'])->name('admin.roles.save');
        Route::post('/roles/nouveau', [RoleController::class, 'store'])->name('admin.roles.store');
        Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->name('admin.roles.destroy');

        /*
         * The categories and the filter. Hiding is a presentation decision and
         * stops at the dropdown; deleting a custom category refuses while
         * anything is still filed under it.
         */
        Route::get('/filtre', [TaxonomyController::class, 'index'])->name('admin.taxonomy');
        Route::post('/filtre', [TaxonomyController::class, 'save'])->name('admin.taxonomy.save');
        Route::post('/filtre/categorie', [TaxonomyController::class, 'addProperty'])->name('admin.taxonomy.add_property');
        Route::post('/filtre/operation', [TaxonomyController::class, 'addDeal'])->name('admin.taxonomy.add_deal');
        Route::delete('/filtre/defaut', [TaxonomyController::class, 'reset'])->name('admin.taxonomy.reset');
        Route::delete('/filtre/{kind}/{slug}', [TaxonomyController::class, 'destroy'])->name('admin.taxonomy.destroy');

        // The name, the tagline, the logo and six brand colours. A save
        // repaints the site on the next request, with no deploy.
        Route::get('/identite', [BrandingController::class, 'index'])->name('admin.branding');
        Route::post('/identite', [BrandingController::class, 'save'])->name('admin.branding.save');
        Route::delete('/identite/defaut', [BrandingController::class, 'reset'])->name('admin.branding.reset');

        /*
         * The home-page carousel. A banner is the one thing on the home page
         * every visitor sees, so its link is validated to http(s) or a
         * site-relative path before it is ever written.
         */
        Route::get('/publicites', [PromoController::class, 'index'])->name('admin.promos');
        Route::post('/publicites', [PromoController::class, 'store'])->name('admin.promos.store');
        Route::patch('/publicites/{promo}', [PromoController::class, 'update'])->name('admin.promos.update');
        Route::post('/publicites/{promo}/visibilite', [PromoController::class, 'toggle'])->name('admin.promos.toggle');
        Route::post('/publicites/{promo}/ordre', [PromoController::class, 'move'])->name('admin.promos.move');
        Route::delete('/publicites/{promo}', [PromoController::class, 'destroy'])->name('admin.promos.destroy');

        /*
         * The editor. The body is typed as text and stored as blocks: nothing
         * an editor writes ever becomes markup, which is why there is no rich
         * text field here and no HTML column behind it.
         */
        Route::get('/articles', [AdminArticleController::class, 'index'])->name('admin.articles');
        Route::get('/articles/nouveau', [AdminArticleController::class, 'create'])->name('admin.articles.create');
        Route::post('/articles', [AdminArticleController::class, 'store'])->name('admin.articles.store');
        Route::get('/articles/{article}/modifier', [AdminArticleController::class, 'edit'])->name('admin.articles.edit');
        Route::patch('/articles/{article}', [AdminArticleController::class, 'update'])->name('admin.articles.update');
        Route::delete('/articles/{article}', [AdminArticleController::class, 'destroy'])->name('admin.articles.destroy');

        /*
         * Comments, across both threads. Hiding keeps the row and takes the
         * comment off the page; deleting is final and offered anyway, because
         * some things should not stay on a disk.
         */
        Route::get('/commentaires', [AdminCommentController::class, 'index'])->name('admin.comments');
        Route::post('/commentaires/annonces/{comment}/masquer', [AdminCommentController::class, 'hide'])->name('admin.comments.hide');
        Route::post('/commentaires/annonces/{comment}/afficher', [AdminCommentController::class, 'show'])->name('admin.comments.show');
        Route::delete('/commentaires/annonces/{comment}', [AdminCommentController::class, 'destroy'])->name('admin.comments.destroy');
        Route::post('/commentaires/articles/{comment}/masquer', [AdminCommentController::class, 'hideArticleComment'])->name('admin.comments.article.hide');
        Route::post('/commentaires/articles/{comment}/afficher', [AdminCommentController::class, 'showArticleComment'])->name('admin.comments.article.show');
        Route::delete('/commentaires/articles/{comment}', [AdminCommentController::class, 'destroyArticleComment'])->name('admin.comments.article.destroy');

        /*
         * The launch. Its own permission: a moderator reviews ads, they do not
         * decide whether the public can see the site at all.
         */
        Route::get('/lancement', [AdminLaunchController::class, 'index'])->name('admin.launch');
        Route::post('/lancement', [AdminLaunchController::class, 'execute'])->name('admin.launch.execute');
        Route::post('/lancement/etat', [AdminLaunchController::class, 'state'])->name('admin.launch.state');
        Route::post('/lancement/compte-a-rebours', [AdminLaunchController::class, 'timer'])->name('admin.launch.timer');

        // Speaking to everybody at once, behind its own permission.
        Route::get('/notifications', [BroadcastController::class, 'index'])->name('admin.broadcast');
        Route::post('/notifications', [BroadcastController::class, 'store'])->name('admin.broadcast.store');

        Route::get('/moderation', [ModerationController::class, 'index'])->name('admin.moderation');
        // The demand queue rides in the same screen, on its own permission.
        Route::post('/moderation/demandes/{propertyRequest}', [ModerationController::class, 'decideRequest'])->name('admin.moderation.request');
        Route::post('/moderation/{listing}/approuver', [ModerationController::class, 'approve'])->name('admin.moderation.approve');
        Route::post('/moderation/{listing}/refuser', [ModerationController::class, 'reject'])->name('admin.moderation.reject');
        Route::post('/moderation/{listing}/mettre-en-avant', [ModerationController::class, 'feature'])->name('admin.moderation.feature');
        Route::post('/moderation/{listing}/archiver', [ModerationController::class, 'archive'])->name('admin.moderation.archive');
    });

    Route::get('/tableau-de-bord', DashboardController::class)
        ->middleware('auth.session')
        ->name('dashboard');

    /*
     * The SEO catch-all: /vente/appartement/alger/bab-ezzouar.
     *
     * Registered last, after every fixed path. The controller checks each
     * segment against the live taxonomy and the seeded geography in order —
     * deal, property type, wilaya, commune — and 404s on anything else, so a
     * crawler cannot walk an unbounded set of empty pages.
     */
    Route::get('/{transaction}/{rest?}', BrowseController::class)
        ->where('rest', '.*')
        ->middleware('launched')
        ->name('browse');
};

/*
 * Arabic has no prefix, so /ar/... is not one of the site's URLs — but it is an
 * obvious thing to type or to hand-write into a link. Redirecting keeps exactly
 * one canonical URL per page per language while not punishing the guess.
 */
Route::redirect('/'.Locale::default()->value, '/', 301);
Route::get('/'.Locale::default()->value.'/{rest}', fn (string $rest) => redirect('/'.$rest, 301))
    ->where('rest', '.*');

/*
 * The referral link. Outside the locale group on purpose: it is pasted into
 * WhatsApp and typed off paper, so it stays as short as it can be, and it
 * redirects rather than rendering anything.
 */
/*
 * The unattended launch. Unlocalised and outside every group: it is called by a
 * cron with a bearer token, never by a browser.
 */
Route::get('/api/cron/launch', [LaunchController::class, 'cron'])->name('cron.launch');

Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');

// Unlocalised: it returns data the form reads, and the commune names come back
// in whatever language the request is in anyway.
Route::get('/api/communes/{wilaya}', CommuneController::class)->name('api.communes');

Route::get('/r/{code}', ReferralController::class)
    ->where('code', '[A-Z0-9]{6}')
    ->name('referral');

Route::prefix('{locale}')
    ->where(['locale' => Locale::prefixedPattern()])
    ->name('localized.')
    ->group($routes);

$routes();
