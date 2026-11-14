# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

> **Tip**: If you find yourself correcting the agent during interactive work, suggest adding a new rule to this file so the lesson is captured for future sessions.

## Project Overview

A Freelens extension for the External Secrets Operator (ESO): a list page and
a details panel for five kinds, ExternalSecret, ClusterExternalSecret,
SecretStore and ClusterSecretStore of `external-secrets.io/v1` and PushSecret
of `external-secrets.io/v1alpha1`; a Force Sync menu item for ExternalSecret
and ClusterExternalSecret; and a panel in the details of a core Secret the
operator manages, with a link to its ExternalSecret.

- **Language**: TypeScript 7.x
- **Runtime**: Freelens >= 2.0.0 (extension API v2, `engines.freelens: ^2.0.0`).
  The host provides React 19, mobx 7 and mobx-react 10 at runtime.
- **Toolchain**: Node.js 24 (`mise.toml`, `.nvmrc`) and pnpm 12 through
  corepack (`packageManager`)
- **Build**: Vite 8 (Rolldown), ES module bundles in `dist/`, with the layout
  of freelensapp/freelens-example-extension, the reference template of a v2
  extension
- **License**: MIT

Library and tool versions follow the Freelens stack exactly: the catalog in
Freelens's `pnpm-workspace.yaml` for libraries, the root `package.json` scripts
of Freelens for tools run with `pnpm dlx` (Biome, knip, Trunk launcher), and
Freelens's `mise.toml` and `.nvmrc` for Node and the other mise tools.
Renovate keeps them there, through the custom datasources in
`.renovaterc.json`, in one `Freelens dependencies` group PR together with a
release of `@freelensapp/extensions`. `@freelensapp/extensions` is pinned to
one exact version. The libraries the host provides at runtime (`react`,
`react-dom`, `mobx`, `mobx-react`) and their types are devDependencies only,
for compiling and testing; the build maps the imports onto the host's copies
("Build"). `electron` is a devDependency for its types only. Freelens installs no dependency of an extension: whatever the code
needs at runtime and the host does not provide has to be in the bundle.

pnpm settings live in `pnpm-workspace.yaml`: `allowBuilds` for the
dependencies with install scripts (a new one must be listed there with `true`
or `false`, or `pnpm install` fails), the default `minimumReleaseAge` of one
day, with `@freelensapp/extensions` and the exact Electron version Freelens
let in early excluded, and `strictPeerDependencies`, which fails the install
when a copy of a shared library is outside the peer range that
`@freelensapp/extensions` declares for it.

## Common Commands

```bash
# Type checking
pnpm type:check                # All of the programs below, in this order
pnpm type:check:sources        # main and renderer, each with src/common/
pnpm type:check:tests          # Tests and test support
pnpm type:check:tooling        # Vite and Vitest configs, build plugins
pnpm type:check:integration    # Integration tests
pnpm type:check:environments   # Environment tests

# Linting & formatting
pnpm biome:check          # TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML, Markdown (biome)
pnpm biome:fix            # Auto-fix the formats above
pnpm trunk:check          # TOML, shell, workflows, yamllint, and Biome again (changed files)
pnpm trunk:fix            # Auto-fix TOML, shell, and the Biome formats
pnpm lint:check           # Alias for biome:check
pnpm lint:fix             # Alias for biome:fix
pnpm knip:check           # Unused files, unused and unlisted dependencies (knip)

# Tests
pnpm test:unit            # vitest
pnpm test:integration     # vitest, against Freelens dev with a kind cluster

# Build
pnpm build                # Both Vite runs, without the type check
pnpm dev                  # Both Vite runs in watch mode, for a directory install

# Pack for testing
pnpm pack:dev             # Bump prerelease version, build, and create .tgz for install in Freelens app

# Clean
pnpm clean                # Clean dist/
pnpm clean:dts            # Remove generated *.d.scss.ts files
pnpm clean:all            # Clean everything (dist, dts, node_modules, tgz)
```

## Architecture

```text
src/
  main/index.ts                      # Main entry (Main.LensExtension), stateless
  renderer/index.tsx                 # Renderer entry: pages, details panels, menu items, customResources
  renderer/api/types.ts              # ESO spec and status types
  renderer/api/store-helpers.ts      # Condition helpers and formatters shared by the models and the details panels
  renderer/api/links.ts              # selfLinks of objects and of the store an object refers to, for the panels' links
  renderer/api/secret-owner.ts       # The ExternalSecret that owns a Secret, from its owner reference and label
  renderer/api/<kind>/<kind>-<version>.ts # Model, KubeApi and KubeObjectStore of a kind, with its tests
  renderer/pages/                    # One list page per kind, and their CSS module
  renderer/details/                  # One panel per kind, StoreDetails for both store kinds, SecretEsoDetails on the host's Secret
  renderer/menus/                    # ForceSyncMenuItem, for ExternalSecret and ClusterExternalSecret
  renderer/components/               # createAvailableVersionPage, ErrorBoundary and its wrappers, ErrorPage
  renderer/icons/                    # The SVG icon, imported with ?raw, and its component
  renderer/vars.scss                 # SCSS variables
  common/                            # Code both entries would import; empty today, its tsconfig.json stays
test/freelens-extensions.ts          # Runtime stub of @freelensapp/extensions for Vitest
environment-tests/                   # Probes for the per-environment programs
integration/__tests__/               # Integration tests, run against Freelens dev over CDP, and their shared module
integration/fixtures/                # Test objects of the integration tests
build/                               # Vite plugins: host modules, standard decorators, CSS module declarations
vite.config.mjs                      # The build, renderer and main
docs/eso-api.md                      # The ESO API from the controller's Go types, which types.ts follows
examples/eso/                        # Test objects on the fake provider (kubectl apply -f)
```

Build output goes to `dist/`: `main.js`, `renderer.js` and `renderer.css`, with
source maps. `main` and `renderer` in `package.json` point at the two entries.

## CRD KubeObject Pattern

A model is a subclass of `Renderer.K8sApi.LensExtensionKubeObject`, one file
per kind and version: `src/renderer/api/externalsecret/externalsecret-v1.ts`,
`clusterexternalsecret/clusterexternalsecret-v1.ts`,
`pushsecret/pushsecret-v1alpha1.ts`, `secretstore/secretstore-v1.ts` and
`clustersecretstore/clustersecretstore-v1.ts`. The four `v1` models also serve
`external-secrets.io/v1beta1`, which an ESO older than 0.16 serves in place of
`v1`, with the same schema ("Adding a kind or a version").

The host reads the model's metadata from the class, through `static readonly`
properties. The objects it hands to the extension, in a list, a details panel
or a menu item, come from the host's store for the resource: they are
instances of the host's `KubeObject`, not of the subclass. The methods of
`KubeObject` itself are there (`getName()`, `getNs()`,
`getCreationTimestamp()`, `getSearchFields()`), a method the subclass defines
is not, and calling it throws. So:

- **Metadata**: `static readonly` `kind`, `namespaced`, `apiBase` and `crd`,
  an `EsoKubeObjectCRD`: the host's `LensExtensionKubeObjectCRD` plus the
  `title` of the page.
- **Instance type**: `declare kind` and `declare apiVersion`, with the kind and
  the version as literals, a union of the versions of a model that serves more
  than one, as the host's documentation of the class has it. Two versions of a
  kind usually differ only in optional fields, so without the literals their
  classes are assignable to each other, and `detailsFor` and `menuItemFor`
  accept a component written for the other version ("Renderer Components").
  `declare` emits nothing, so the runtime object is the host's as before.
- **Per-object logic**: a `static` method that takes the object, such as
  `ExternalSecret.getReady(object)`. The Ready condition logic is in
  `store-helpers.ts`; the statics delegate to it with the default texts of
  their kind (`Ready`/`Not Ready` for an ExternalSecret, `Valid`/`Invalid` for
  a store), and the details panels call the helpers directly.
- **Fields**: `object.spec` and `object.status`, typed by the kind's spec and
  status interfaces in `types.ts`.
- **Forbidden**: instance methods on the subclass; a fallback such as
  `typeof (object as any).getReady === "function" ? ...`, which always takes
  the fallback; `as any`.

```typescript
export class SecretStore extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  SecretStoreStatus,
  SecretStoreSpec
> {
  declare kind: "SecretStore";
  declare apiVersion: "external-secrets.io/v1" | "external-secrets.io/v1beta1";

  static readonly kind = "SecretStore";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/external-secrets.io/v1/secretstores";

  static readonly crd: EsoKubeObjectCRD = {
    apiVersions: ["external-secrets.io/v1", "external-secrets.io/v1beta1"],
    plural: "secretstores",
    singular: "secretstore",
    shortNames: ["ss"],
    title: "Secret Stores",
  };

  static getReady(object: SecretStore): boolean | undefined {
    return getReady(object.status?.conditions);
  }
}

export class SecretStoreApi extends Renderer.K8sApi.KubeApi<SecretStore> {}
export class SecretStoreStore extends Renderer.K8sApi.KubeObjectStore<SecretStore, SecretStoreApi> {}
```

The file also exports a `KubeApi` and a `KubeObjectStore` subclass. The list
page uses the `KubeApi` type for `KubeObjectListLayout`; neither is
instantiated, because the store comes from the host. The host registers an
API, and with it a store, for every version of a CRD the cluster serves, and
`SecretStore.getStore<SecretStore>()` returns the one for the first entry of
`crd.apiVersions` that is served; it throws when none is. The pages and the
menu item call it while they render, which happens in a cluster frame only.

`createAvailableVersionPage` decides whether a kind is served with
`kubeObjectClass.getStore()` and renders a "Not Available" page otherwise.
The page it returns is an `observer`: `getStore()` reads the host's observable
API registry, and the host registers a CRD's APIs after the cluster frame has
loaded the CRDs, so a page opened before that renders again when the kind is
served. Freelens restores the last page when a cluster is opened, so this
happens often. `src/renderer/components/available-version.test.tsx` checks it
with a spy on `getStore` that reads an observable.

`customResources` in `src/renderer/index.tsx` lists the five model classes.
The host reads the group and plural from each class's `crd`, and while the
extension is enabled it leaves the resources out of the Custom Resources tree
of the cluster sidebar, where they would otherwise be listed a second time
under `external-secrets.io`. Their definitions stay in the Definitions list,
and the host's own list and details stay reachable by URL and from the command
palette. A model the extension only decorates, with a details panel or a menu
item and no page of its own, stays out of the field: registered, it would leave
the tree with nothing in its place.

### Types

The types in `src/renderer/api/types.ts` follow the ESO controller's Go types,
read from its sources at the release that serves the version (`docs/eso-api.md`
has the mapping and the sources), not from memory:

- Every Go struct has a TypeScript interface of the same name, with the same
  fields under their `json` names.
- A field is optional when the CRD does not require it. `controller-gen`
  decides that from the `+required` and `+optional` markers, not from the
  `json` tag; the generated CRD settles any doubt.
- Every `+kubebuilder:validation:Enum` is a string-literal union type alias.
- `spec.provider` of the stores is an open record: the controller requires
  exactly one of 40+ backends, each with its own shape.
- A condition is `Renderer.K8sApi.BaseKubeObjectCondition`. The whole of the
  host's kube-object package is re-exported from `K8sApi`; nothing is imported
  from another `@freelensapp/*` package, which are private in v2.

### Adding a kind or a version

1. **The types** in `types.ts`, as above. A new version of a kind starts as a
   copy of the newest version's files; the diff of the Go types between the two
   releases says what changes. A version with the same schema as one a model
   already serves, as `v1beta1` is to `v1` (ESO 0.16 made `v1` a copy of it),
   gets no files: it joins the model's `crd.apiVersions`, after the newer
   version, which the host tries first, and its `declare apiVersion` union, and
   the integration matrix gets a release that serves only it.
2. **The model**, `src/renderer/api/<kind>/<kind>-<version>.ts`, with the
   `declare kind` and `declare apiVersion` literals, its `KubeApi` and its
   `KubeObjectStore`.
3. **The list page** in `src/renderer/pages/`, a configurable list with an `id`
   on every column ("Renderer Components"), passed through
   `createAvailableVersionPage` (newest version first when a kind has more than
   one) and registered in `clusterPages` and `clusterPageMenus`.
4. **The details panel** in `src/renderer/details/`, with none of the items the
   host's details already show ("Renderer Components"), registered in
   `kubeObjectDetailItems` with `Renderer.K8sApi.detailsFor` and the model
   class.
5. **Menu items** in `src/renderer/menus/`, registered in `kubeObjectMenuItems`
   with `Renderer.K8sApi.menuItemFor` and the model class, only for what the
   resource supports: Force Sync writes the `external-secrets.io/force-sync`
   annotation, which the ESO controller reconciles on for ExternalSecret and
   ClusterExternalSecret, and not for the stores or PushSecret
   (`docs/eso-api.md`, section 4.2).
6. **`customResources`**: the model class of every version that has a page.
7. **Tests** for the static helpers, next to the model, and the kind's cases in
   `src/renderer/pages/pages.test.tsx` and
   `src/renderer/details/details.test.tsx`, with the printer columns of its CRD
   in `hostItems`; a member of the host that a test reaches goes into the stub,
   as small as the test needs.
8. **A test object** in `examples/eso/`, and its row in `README.md`.
9. **The integration tests**: the plural of the kind in `crdPlurals` of
   `integration/__tests__/extension-helpers.ts`, a test object named `test` in
   `integration/fixtures/`, and the kind's entry in `kindViewsFor` of
   `integration/__tests__/eso-views.ts` ("Workflows").

Then check the result in Freelens with the checkout installed from its
directory (`README.md`, "Development loop"): the page lists the test object,
the details show every field, the menu item works, and the resource is gone
from the Custom Resources tree.

## Renderer Components

- Pages and details panels are `observer` components from `mobx-react`, which
  the build maps to the host's copy.
- Every page, details panel and menu item renders inside an `ErrorBoundary`
  from `src/renderer/components/error-boundary.tsx`, a class component of the
  host's React. It logs what its children throw with `extension.name` and the
  component stack, and renders `ErrorPage` in place of a page or a details
  panel, and nothing in place of a menu item. A details panel or menu item
  renders again when the host passes a new `object`, the boundary's reset key.
  - The boundary is applied where the registrations are made: `clusterPages`,
    `kubeObjectDetailItems` and `kubeObjectMenuItems` are mapped through
    `withPageErrorBoundary`, `withDetailsErrorBoundary` and
    `withMenuItemErrorBoundary`, each taking `this` and a registration, so an
    entry added to a field is wrapped too. Each field is annotated with its type
    from `Renderer.LensExtension`, because the mapping refers to `this`, and
    its type would otherwise depend on itself.
  - The wrappers take the registration that `Renderer.K8sApi.detailsFor` and
    `menuItemFor` built, so the helpers check each component against its model
    first, with no cast.
  - A `try`/`catch` around the call of a component is not enough: a child
    throws when React renders it, and a callback such as `renderTableContents`
    of `KubeObjectListLayout` throws from the host's render. Such an error goes
    up to the host's boundary, which replaces the main area for a page and the
    whole cluster frame for a details panel or a menu item.
- The `kubeObjectDetailItems` and `kubeObjectMenuItems` registrations are made
  by `Renderer.K8sApi.detailsFor(ExternalSecret, { priority: 10, Details })`
  and `Renderer.K8sApi.menuItemFor(ExternalSecret, { MenuItem })`, not written
  out with `kind` and `apiVersions`. The helper takes both from the model class
  and types the props of `Details` and `MenuItem` from it, so a component
  written for another model fails the type check. The check is structural: it
  tells two kinds or versions apart by the `declare kind` and
  `declare apiVersion` literals of each model ("CRD KubeObject Pattern").
- The components are registered as they are, `Details: ExternalSecretDetails`
  and `MenuItem: ForceSyncMenuItem`. Their props are
  `Renderer.Component.KubeObjectDetailsProps<Model>` and
  `Common.Types.KubeObjectMenuItemProps<Model>`: the concrete model class, never
  `any`, and only what the host passes. A menu item does not extend
  `Renderer.Component.KubeObjectMenuProps`, the props of the host's whole
  `KubeObjectMenu`. A component may take the union of the models it serves:
  `StoreDetails` serves both store kinds, and `ForceSyncMenuItem` serves
  ExternalSecret and ClusterExternalSecret, picking the store to patch by the
  `kind` of the object, a literal on each model.
- A details panel shows only what the host's details leave out. Next to it,
  for every kind with a CRD, the host renders its own details of a custom
  resource: the printer columns of the CRD, without Age, under the names that
  `startCase` gives them, and the conditions, whose reason and message are only
  in a tooltip. So a panel shows no printer column and no conditions again;
  it shows the fields the columns leave out, the references as links, and the
  message of the Ready condition. A link to an object whose name is a printer
  column is named after the spec field, such as Secret Store Ref, so that it
  is not read as the column a second time. `hostItems` in
  `src/renderer/details/details.test.tsx` has the printer columns of every kind,
  and the test fails on a panel item among them.
- A list page is a configurable list (`isConfigurable`) whose every column has
  an `id`, the key of its sorting callback, as the host's own lists, such as
  Jobs, have it: the host makes a column with an id resizable, keeps its width
  per `tableId`, and lets the user hide it from the menu of the list, which is
  how a narrow window stays readable. A text cell is in `WithTooltip`, which
  shows a cut value whole, and a time is shown as `kubectl get` prints a date
  column, the time since it, by `LastSync` in `src/renderer/pages/last-sync.tsx`.
  `src/renderer/pages/pages.test.tsx` checks the columns of every page, their
  ids, and a cell for every column; the stub's `KubeObjectListLayout` is a mock,
  so that the test reads the props a page passes.
- A menu item that patches an object catches the patch: it runs in `onClick`,
  where an error reaches no error boundary, so a failed patch, such as a 403
  for a user without the RBAC to patch the object, is shown with
  `Notifications.error`, naming the action, the kind and the object, and the
  promise never rejects.
- `SecretEsoDetails` is registered with `detailsFor(Renderer.K8sApi.Secret, ...)`,
  on a built-in kind of the host, whose `apiVersions` the helper reads from
  `apiBase`. It reads the owner reference and the managed label of the Secret
  itself (`src/renderer/api/secret-owner.ts`), so it needs no store, and it
  renders nothing for a Secret the operator does not manage.
- A link to another object is `Renderer.Component.MaybeLink` with
  `Renderer.Navigation.getMaybeDetailsUrl(selfLink)`, and the selfLink comes
  from `selfLinkOf` or `storeSelfLink` in `src/renderer/api/links.ts`, built
  from the `apiBase` of the API the host registered for the kind (`getApi()`),
  so that it names the version the cluster serves, which the drawer needs to
  find the object, or from the static `apiBase` when there is no such API, as
  for the host's Secret. An empty selfLink renders the text without a link,
  as for a SecretStore referred to from a cluster-scoped object, which lives in
  each target namespace. Nothing loads another store for a link: the drawer
  resolves the object when it opens.
- The host renders a cluster page with `params` only. A page that needs the
  extension gets it from the registration
  (`Page: () => <ExternalSecretsPageAvailable extension={this} />`), with the
  page component created once, outside the registration. `PageComponents.Page`
  is typed with the props the host passes, so the type check rejects a page
  that requires another prop; it does not reject one that declares another
  prop as optional, which is then `undefined`.
- **CSS**: a component imports its CSS module for the class names only, with no
  `?inline` import and no `<style>` tag; the rules reach the page through
  `dist/renderer.css`, which the host links next to the renderer entry ("CSS"
  under "Build"). CSS modules use `camelCaseOnly` class names; SCSS variables
  are in `src/renderer/vars.scss`, used with `@use "../vars"`.
- SCSS modules get TypeScript declarations (`*.module.d.scss.ts`), written by
  `build/vite-plugin-css-module-declarations.mjs` during the renderer build,
  without a key for a class inside `:global(...)`. They are committed, because
  `pnpm type:check` and `type-check.yaml` run without a build, and
  `allowArbitraryExtensions` in the renderer's `tsconfig.json` makes the import
  resolve to them, so a class name the stylesheet lacks fails the check. Commit
  the regenerated file with a change to its SCSS module; `pnpm clean:dts`
  removes them.
- Icons are SVG files imported with `?raw` and rendered by
  `Renderer.Component.Icon` through its `svg` prop. Biome leaves `.svg` files
  alone (`biome.jsonc`), so the icon stays minified.

## Rules That Fail Silently

Each of these compiles when it is broken, and breaks the extension at runtime
or not visibly at all. The sections named in parentheses explain the
mechanism; this is the list to check a change against.

- **The host's React and mobx, one copy each.** Import `react`, `react-dom`,
  `mobx` and `mobx-react` by their bare module ids. A second React throws
  `invalid hook call`; a second mobx throws nothing, and the host never reacts
  to its observables. The build fails on the ways a second copy gets in
  ("Modules provided by the host").
- **Standard decorators.** An observable field is `@observable accessor`, and
  the class does not call `makeObservable(this)`. Without `accessor` the
  production build of mobx leaves the field unobservable; a unit test that
  imports the class fails ("Decorators").
- **No Node or Electron in renderer and common code.** They are `undefined` in
  the renderer. The build fails on an import, `pnpm type:check` on a global
  ("Process-specific settings").
- **One CSS asset, `dist/renderer.css`.** Any other name, or a second asset,
  leaves the extension unstyled. Nothing checks it; look at `dist/` after a
  change to the CSS setup ("CSS").
- **One tsconfig per environment.** Each program has only its runtime's `lib`
  and `types`, and no declaration may load Node into the renderer or the DOM
  into main; otherwise a wrong API type-checks and is `undefined` at runtime.
  The environment tests fail on a leak ("TypeScript").
- **No instance method on a KubeObject subclass.** The objects from the host
  do not have it, and the call throws. Nothing checks it
  ("CRD KubeObject Pattern").
- **A component that chooses the version through `getStore()` is an
  `observer`.** The host registers a CRD's APIs after the cluster frame has
  loaded the CRDs; a component that is not an `observer` and rendered before
  then shows the kind as not installed until the user navigates away and back.
  Only a test whose `getStore` reads an observable shows it
  ("CRD KubeObject Pattern").
- **`this.props` of an `@observer` class component only in its `render()`.**
  Under mobx-react 10 they are not observable. A `@computed` getter that reads
  them, or a method the host calls from its own derivations (`getItems` and
  `customizeHeader` of `KubeObjectListLayout`), throws
  `[mobx-react] Cannot read "X.props" in a reactive context` when the page
  renders, and the host shows its "App crash" page. The type check, the build
  and unit tests in a Node environment pass. Read the values in `render()` and
  hand them to the callback, or make the component a function component
  ("MobX 7 and mobx-react 10 (standard decorators only)" in Freelens's
  `migrating-from-v1.md`).
- **A memo over a store's items is keyed on something that changes with
  them.** The host keeps one observable array per store and updates it in
  place, with `replace` and `splice`, so `store.items` stays the same array
  while the objects in it change. A `useMemo` keyed on it, or on a prop that
  holds it, is computed once, and an open view keeps the objects it was opened
  with. An `observer` that reads the items while it renders follows them; a
  memo needs a key such as the ids and `resourceVersion`s of the objects. It
  shows only on a cluster whose objects change while the view is open.
- **An effect creates what its cleanup aborts or releases.** Freelens dev
  renders in `React.StrictMode`, which runs an effect, cleans it up and runs
  it again on the same instance. An `AbortController` kept in a `useRef` is
  aborted by the first cleanup, and every request of the second run with it;
  the host takes an aborted `loadAll` for no failure, so the view shows
  nothing and logs nothing. Create the controller, and the list of watches to
  release, inside the effect. The production build has no `StrictMode`, so
  only Freelens dev shows it, and only in a view that loads stores no other
  page has loaded before it.
- **Every page, details panel and menu item inside an error boundary.** A
  `try`/`catch` around the call of a component catches only what the call
  throws, not what a child throws when React renders it or what a callback of
  `KubeObjectListLayout` throws from the host's render. Such an error replaces
  the main area with the host's error, or, from a details panel or a menu item,
  the whole cluster view with the host's crash page. Map `clusterPages`,
  `kubeObjectDetailItems` and `kubeObjectMenuItems` through their wrappers in
  `error-boundary.tsx` ("Renderer Components").
- **A menu item catches what it patches.** An error of `onClick` reaches no
  error boundary: an uncaught failed patch is an unhandled rejection, and the
  user sees nothing ("Renderer Components").
- **A cluster page gets the extension from its registration.** The host passes
  `params` only. The type check rejects a page that requires another prop, but
  not one that declares it optional ("Renderer Components").
- **An ESM `main`, and the entries in `package.json` unchanged while
  `pnpm dev` runs.** The host refuses to reload a CommonJS main and logs why,
  and it watches only the entries it started with, so a manifest change needs
  Freelens restarted.
- **A bundled CommonJS package loads in the ESM main.** Main is built for
  Rolldown's `node` platform, which gives it a `require`, and defines
  `__dirname` and `__filename`. Without either, the package throws when
  Freelens evaluates `dist/main.js`, and the extension does not activate;
  `pnpm build` and `pnpm type:check` pass ("Process-specific settings").

Neither `pnpm build` nor `pnpm dev` runs the type check, so a Node global in
renderer code passes them; `pnpm type:check` and `type-check.yaml` catch it.
- **The testing helpers of React stay out of the extension's code.** `act`,
  `react-dom/test-utils` and `@testing-library/*` work in the unit tests, which
  run the development build of React, and throw in the host, which runs the
  production build. Biome's `noRestrictedImports` rejects them outside the
  tests.

## Build

`vite.config.mjs` builds one entry point per run, in library mode, as ESM:
`vite build` builds the renderer and empties `dist/`, and `vite build --mode
main` builds main next to it. The two runs share no chunk; each bundle carries
its own copy of the `src/common/` code it imports. Nothing is minified.

`pnpm dev` runs the same two builds in watch mode, side by side, for a
directory install: the host reloads the extension when either entry is
rewritten. Its renderer run passes `--no-emptyOutDir`. In watch mode Vite
empties the output directory again before every rebuild, so a renderer rebuild
would delete `dist/main.js`, and the host would have no main entry to reload.

### Modules provided by the host

The host publishes its singletons on `globalThis.FreelensExtensionApi`, and
each process publishes only the ones it has. This is contract C3 of the
Freelens extension API (`docs/extensions/api.md`):

| Module id           | Global            | Published in |
| ------------------- | ----------------- | ------------ |
| `react`             | `React`           | renderer     |
| `react-dom`         | `ReactDom`        | renderer     |
| `react/jsx-runtime` | `ReactJsxRuntime` | renderer     |
| `mobx`              | `Mobx`            | both         |
| `mobx-react`        | `MobxReact`       | renderer     |
| `monaco-editor`     | `MonacoEditor`    | renderer     |

`build/vite-plugin-host-modules.mjs` replaces a bare import of one of these
with a module that reads the global, in the extension's code and in every
library it bundles. Its named exports are the members of the copy installed as
a devDependency, which is pinned to the host's version, so an import of a name
the host's version lacks fails the build. The plugin also fails the build on an
import of a host module that the process does not publish (`react` in main),
and on a subpath of a host package that the host does not publish
(`react-dom/client`, `react/jsx-dev-runtime`). Both would otherwise either read
`undefined` at runtime or bundle a second copy. A second React throws
`invalid hook call`; a second mobx throws nothing, and the host simply never
reacts to its observables.

Everything else is bundled. That includes `@freelensapp/extensions`, a shim of
three lines that reads `Common`, `Main` and `Renderer` off the same global; it
must not be mapped. The host installs no dependencies of an extension, so
whatever the code needs at runtime and the host does not provide has to be in
the bundle.

### Process-specific settings

- **Renderer**: nothing is external. Renderer code gets no Node or Electron, and
  an import of a Node builtin or of `electron` fails the build (Vite would
  otherwise replace it with an empty module and only warn).
  `process.env.NODE_ENV` is replaced at build time, because library mode
  leaves it for a consumer's bundler and the page has no `process`.
- **Main**: Node builtins (`node:*` and bare) and `electron` stay external.
  Bundled packages resolve with Vite's server conditions, so main gets their
  Node builds rather than their browser builds. Main is built for Rolldown's
  `node` platform (`build.rolldownOptions.platform`), the renderer for
  `browser`, the default of a Vite client build. A bundled CommonJS package
  `require()`s the builtins, and an ES module has no `require`: for the
  `browser` platform Rolldown turns the call into a `__require` shim that
  throws ``Calling `require` for "node:assert" in an environment that doesn't
  expose the `require` function`` as soon as the bundle is evaluated, and for
  `node` it defines `__require` with `createRequire(import.meta.url)`.
  `__dirname` and `__filename` are the other half: Node passes them to a
  CommonJS module, Rolldown leaves them as they are on either platform, and
  the ES module throws `ReferenceError: __dirname is not defined in ES module
  scope`. Main defines them (`define`) as `import.meta.dirname` and
  `import.meta.filename`, the directory and file of `dist/main.js`, not of the
  package: a library that loads a file next to itself, such as a `.wasm`,
  finds it only when the build puts it in `dist/`.
  `pnpm build` and `pnpm type:check` pass either way, and nothing before
  Freelens evaluates `dist/main.js`, so on the wrong platform the extension
  fails only when Freelens loads it. A main bundle without CommonJS is the
  same on both platforms, byte for byte.

### Decorators

MobX 7 supports standard decorators only, and Oxc, which transpiles TypeScript
for Vite, passes them through unlowered, while neither Node nor Chromium runs
them yet. `build/vite-plugin-standard-decorators.mjs`, copied from Freelens,
hands every module with a decorator to esbuild first, which lowers the
decorators and their `accessor` fields. Both `vite.config.mjs` and
`vitest.config.ts` use it. A decorator that reaches the host or a test
unlowered is a syntax error when the module is evaluated.

An observable field is an `accessor` (`@observable accessor enabled = false;`),
and the class does not call `makeObservable(this)`. `@observable` on a plain
field type-checks and builds; the development build of mobx throws when the
class is defined, and the production build leaves the field unobservable.

### CSS

The host links the stylesheet named after the renderer entry, `renderer.css`
next to `renderer.js`. Library mode extracts the CSS of the whole bundle into
that one file (`build.lib.cssFileName`). A build that emits more than one CSS
asset, or a differently named one, leaves the extension unstyled. A component
imports its CSS module for the class names only and renders no `<style>` tag;
the rules reach the page through `renderer.css`. CSS modules
use `camelCaseOnly` class names.

### CSS module declarations

`build/vite-plugin-css-module-declarations.mjs` writes `x.module.d.scss.ts`
next to every `x.module.scss` the renderer build imports, in `vite build` and
in watch mode. It takes the class names from Vite's own `preprocessCSS`, with
the build's resolved config, so they are the names the bundle exports, after
`localsConvention`; a class inside `:global(...)` is not one of them.

The plugin is written so that a build cannot leave a committed declaration
empty or partial, whether it fails, is interrupted or is killed:

- it awaits its work in `transform`, so the build does not end while a write is
  pending;
- it writes a declaration only when the content changed, so a build that
  changes no stylesheet touches no file;
- it writes to a temporary `*.tmp` file next to the declaration and renames it
  over the declaration, which replaces it whole or not at all.

The plugin has no options and no dependency other than Vite, and it refers to
no path of this repository, so other extensions copy it unchanged.

## TypeScript

Main code runs in Node, renderer code in a browser page, and common code in
both. Each is type-checked in a program of its own, so that an API the runtime
does not have fails `pnpm type:check` rather than the extension:

| Config                       | lib                       | types                             | Files                                                              |
| ---------------------------- | ------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `src/main/tsconfig.json`     | ES2024                    | `node`                            | `src/main/`, `src/common/`                                         |
| `src/renderer/tsconfig.json` | ES2024, DOM, DOM.Iterable | `vite/client`                     | `src/renderer/`, `src/common/`                                     |
| `src/common/tsconfig.json`   | ES2024, WebWorker         | none                              | `src/common/`                                                      |
| `src/tsconfig.json`          | ES2024, DOM, DOM.Iterable | `node`, `vite/client`             | `*.test.ts(x)` under `src/`, and `test/`                           |
| `integration/tsconfig.json`  | ES2024, DOM, DOM.Iterable | `node`, `@freelensapp/extensions` | `integration/`                                                     |
| `tsconfig.json`              | ES2024                    | `node`                            | `vite.config.mjs`, the Vitest configs, `svgo.config.mjs`, `build/` |

All of them extend `tsconfig.base.json`, which has the compiler options of
Freelens's fixture extension: `strict`, `moduleResolution: Bundler`,
`useDefineForClassFields`, `noUncheckedSideEffectImports` and `skipLibCheck`
among them. `skipLibCheck` is required: `extension-api.d.ts` is one declaration
for both processes and names DOM types and the `Electron` namespace, which no
single program has. Write `types` in every config; it decides which `@types`
packages a program sees.

### Main, renderer and common

The main and renderer configs both include `src/common/`. Compiled as main,
common code fails on the DOM; compiled as renderer, it fails on Node. What
passes both is valid in both, and that is the check that decides. Common code
uses only what both runtimes have: `globalThis.crypto`, `TextEncoder` and
`TextDecoder`, `URL` and `URLSearchParams`, `AbortController`,
`structuredClone`, and the timers, with the timer handle kept opaque.

`src/common/tsconfig.json` is for the editor, which gives a file to one config
only. Its `WebWorker` lib is the closest single match and an approximation:
`self` and `postMessage` compile there and fail in the main program.

The common program is not compiled on its own. `environment-tests/tsconfig.json`
extends `src/common/tsconfig.json` and keeps its `include`, so
`tsc -p environment-tests`, in `pnpm type:check:environments`, compiles
`src/common/` with the common settings, together with the probes. A program of
`src/common/` alone has no input when the directory has no source file, and
`tsc` stops on that (TS18003); the environment tests always have their probes,
so `pnpm type:check` passes with an empty `src/common/`. Keep
`src/common/tsconfig.json` even then: the editor uses it, and the environment
tests extend it.

The split does not cover the API namespaces: `Main` and `Renderer` compile in
every program, and the one the process does not have is `undefined` at runtime.
Common code uses `Common`.

### Asset imports

The renderer program has `vite/client`, which declares `*?raw`, `*?inline` and
the CSS modules and brings no Node into the program. With
`allowArbitraryExtensions`, `import styles from "./x.module.scss"` resolves to
the generated `x.module.d.scss.ts`, so a class name that the stylesheet lacks
fails the check. Without that file, after `pnpm clean:dts`, the import falls
back to the untyped declaration of `vite/client`.

### Environment tests

`types` and `lib` alone do not keep an environment pure. A declaration file
with `/// <reference types="node" />` loads all of `@types/node` into any
program that reaches it, whatever `types` says, and one with
`/// <reference lib="dom" />` loads the DOM. `environment-tests/` proves the
split holds:

| File             | Compiled with          | Must                      |
| ---------------- | ---------------------- | ------------------------- |
| `node-apis.ts`   | renderer, common       | fail on every marked line |
| `dom-apis.ts`    | main, common           | fail on every marked line |
| `worker-apis.ts` | main                   | fail on every marked line |
| `shared-apis.ts` | main, renderer, common | pass                      |

Each line that must fail carries `// @ts-expect-error`, so a program that
starts accepting it fails with an unused directive. The configs there extend
the source configs and keep their `include`, so the probes are compiled
together with the sources and every declaration the sources reach. Compiled
alone, they would not see a declaration that a dependency of the sources brings
in.

When a declaration leaks, the environment tests fail; keep the leak out rather
than relax a probe. For Node
in the renderer, point `typeRoots` of the renderer config at a directory with
an empty `node` package, which a reference directive resolves to first. For
the DOM in main, remove the directive from the declaration with `pnpm patch`.

### Tests and tooling

Tests are not in the environment programs. Vitest runs them in Node, with
jsdom for files that ask for it, so `src/tsconfig.json` gives them the DOM and
Node. It sits in `src/` so that an editor finds it for a test file: the
environment config next to the test excludes it, and the editor goes on to the
next `tsconfig.json` up the tree. Tests compile against the real
`@freelensapp/extensions` declaration, while Vitest replaces the package with
`test/freelens-extensions.ts` at runtime.

No config declares the Vitest globals. TypeScript has no per-file globals, so
declaring `describe` or `vi` for tests would declare them for every file in the
program. Test and test-support files import what they use:

```ts
import { describe, expect, it, vi } from "vitest";
```

The module resolves from every program, so Biome keeps it out of the
extension's code: `style/noRestrictedImports` rejects an import of `vitest`
outside `src/**/*.test.*`, `test/` and `integration/`. The same rule rejects
there the testing helpers of React: the `act` named import of `react`,
`react-dom/test-utils` and `@testing-library/*`. They type-check, build and
pass the unit tests, which run the development build of React, but `act`
delegates to `React.act`, which the production build that Freelens runs leaves
out, so the call throws only in the host. `globals: true` stays on in
`vitest.config.ts` at runtime only, because React Testing Library registers its
automatic cleanup only when `afterEach` is a global.

`@freelensapp/extensions` is stubbed because the real package cannot run in a
test: it is a shim that reads `Common`, `Main` and `Renderer` off
`globalThis.FreelensExtensionApi`, which only the host sets, and it ships no
mocks. The `alias` in `vitest.config.ts` points the import at
`test/freelens-extensions.ts`, for the tests and for the extension code they
import. The stub covers only what the tests use, at runtime only; the type
check still uses the real declaration. So a test that reaches a member the stub
lacks compiles and fails on `undefined`: add the member to the stub, as small as
the test needs. The other host modules are not stubbed: `react`, `mobx` and
`mobx-react` resolve to the devDependencies, the host's versions.

The root `tsconfig.json` checks the tooling files. It has `checkJs`, so the
Vite config and the build plugins are type-checked too; give their function
parameters JSDoc types.

## Tests

Vitest (`vitest.config.ts`) runs the `*.test.ts(x)` files under `src/` in
Node, with jsdom for a file that starts with `// @vitest-environment jsdom`.
Its plugins are the ones of the build that the tests need: the standard
decorators and the React plugin for JSX. What the tests compile against, and
the stub of `@freelensapp/extensions`, are in "Tests and tooling". The stub's
`LensExtensionKubeObject.getStore()` throws, as the host's does for a version
that is not served; a test that needs a store spies on `getStore` of its class.

The integration tests are apart: `vitest.integration.config.ts` runs the
`*.tests.ts` files in `integration/__tests__/` against Freelens dev, and
`integration/tsconfig.json` type-checks them ("Workflows").

## Lint and CI

### Biome

`biome.jsonc` has the formatter, import groups and rules of Freelens. Two
overrides are specific to how the extension is laid out:

- `style/noRestrictedImports` keeps `vitest` and the testing helpers of React
  out of the extension's code (see "Tests and tooling").
- `correctness/noNodejsModules` rejects a Node builtin import in
  `src/renderer/` and `src/common/`, tests left out. It flags the import in the
  editor, before `pnpm type:check` does; it does not see Node globals such as
  `Buffer` or `process`, which only the type check catches.

Every path in an override starts with `**/`. Trunk runs Biome on a copy of the
files in a sandbox outside the repository, and there a path anchored at the
repository root matches no file, so the override silently does nothing. A
plain `biome check` matches both forms, so only `trunk check` shows the
difference.

The Biome commands in `.trunk/trunk.yaml` let Biome find the copy of
`biome.jsonc` in the sandbox rather than pass `--config-path`. Biome 2.6.4
ignores every parser option when the config is given explicitly, with
`--config-path` or `BIOME_CONFIG_PATH`.

In that sandbox, Biome also cannot apply `vcs.useIgnoreFile`: since 2.5.15 it
matches every target against the repository's `.gitignore` and panics on a
path outside the repository root, so every file fails. The Biome commands in
`.trunk/trunk.yaml` pass `--vcs-use-ignore-file=false`, because Trunk applies
`.gitignore` itself before it picks the targets; `biome.jsonc` keeps the
setting on for `pnpm biome` and editors.

Renovate updates Biome, in the `biome` script and in `.trunk/trunk.yaml`, but
cannot run `biome migrate`. `biome-migrate.yaml` runs it on the Renovate
branch, then `biome format --write` with the migrated config, and commits the
migrated `biome.jsonc` and the reformatted files there, so that the update, its
migration and the formatting the new version changes are one pull request.
`--update` stages only tracked files, which are all the formatter touches. The
commit is by `github-actions[bot]`, which
`gitIgnoredAuthors` in `.renovaterc.json` lists, so that Renovate does not take
it for a manual edit and stop updating the branch.

Biome formats SCSS, YAML, Markdown and the SVG icon too, as in Freelens, so
Trunk runs no Prettier or markdownlint; yamllint still checks YAML. The
Kubernetes manifests in `examples/` and `integration/fixtures/` are the
exception: their sequences stay unindented, as kubectl writes them, which Biome
cannot do, so yamlfmt formats them with the `.yamlfmt.yaml` of each directory,
and the ignore rules of `.trunk/trunk.yaml` give them to yamlfmt only.
`biome.jsonc` leaves them out, together with `pnpm-lock.yaml` and
`pnpm-workspace.yaml`, which pnpm writes, and `.trunk/`, whose `trunk.yaml`
`trunk upgrade` rewrites.

The Markdown rules are in `nursery`.

### Knip

`pnpm knip:check` runs knip twice, for unused files and for dependencies: a
development pass over everything, and a `--production --strict` pass over the
code that reaches the bundles, which are the entries marked with `!` in
`knip.jsonc`. In the production pass only `dependencies` count, so a bundled
library that the extension's code imports belongs there. The host-provided
modules are devDependencies, for their types, and are ignored.

A file is unused when no entry reaches it: a leftover module, a barrel that
nothing imports. The production pass starts from the `!` entries only, so it
also reports a module that only tests import. The fix is to remove the file,
not to ignore it. The check does not include unused exports and types: on this
tree they are mostly the exported spec and status types of the models.

`knip.jsonc` lists the entries knip cannot find: the two source entries, the
Vitest alias target `test/freelens-extensions.ts`, the integration tests and
the probes in `environment-tests/`. Its Vite plugin is off: it adds the
renderer entry of `vite.config.mjs` as a development entry, which displaces
`src/renderer/index.tsx!`, and the production pass then skips the renderer.
`--no-config-hints` is set because one config serves both passes, and an entry
that only the production pass needs is reported as redundant by the other.
`kubectl`, which the integration tests call, comes from the system, or from
helm/kind-action in CI, and `yq` from mise, so both are in `ignoreBinaries`.

Two more settings keep the file check to real findings. `project` leaves out
the CSS module declarations with `!src/**/*.d.scss.ts`: TypeScript reaches them
through `allowArbitraryExtensions`, while knip resolves
`import styles from "./x.module.scss"` to the stylesheet, so nothing would
import them. The negation has no trailing `!`, which would apply it to the
production pass only. And the SVGO plugin is on (`"svgo": true`), so that
`svgo.config.mjs` is an entry: Trunk runs SVGO, and no dependency turns the
plugin on.

`ignore` leaves out `dist/**`. The `main` field of `package.json` makes
`dist/main.js` an entry once it exists, and the `knip` script runs with
`--no-gitignore`, so after `pnpm build`, which `check.yaml` runs first, knip
would analyse the bundle and report what it inlines from the libraries it
bundles. Run `pnpm knip:check` after a build when changing `knip.jsonc`, as
`check.yaml` does; without `dist/` the problem does not show.

### Workflows

| Workflow                                       | Runs                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `type-check.yaml`                              | `pnpm type:check`                                                                                                                     |
| `check.yaml`                                   | `pnpm build`, `pnpm lint:check`, `pnpm knip:check`                                                                                    |
| `unit-tests.yaml`                              | `pnpm test:unit`                                                                                                                      |
| `trunk-check.yaml`                             | `trunk check --all`                                                                                                                   |
| `integration-tests.yaml`                       | the integration tests in `integration/`, against Freelens dev                                                                         |
| `mise-lock-check.yaml`                         | on a change to `mise.lock`: no checksum changed for an unchanged tool version                                                         |
| `cleanup-cache.yaml`                           | on a closed pull request: deletes the caches of its merge ref                                                                         |
| `biome-migrate.yaml`                           | `biome migrate` on a Renovate branch                                                                                                  |
| `npm-dedupe.yaml`, `trunk-upgrade.yaml`        | scheduled maintenance, each in an `automated/*` pull request; `/rerun` by a collaborator reruns one                                   |
| `npm-version.yaml`, `tag.yaml`, `release.yaml` | the version bump pull request, the tag when it merges (or `/tag` by a collaborator), the npm publish and GitHub release of a `v*` tag |
| `claude.yaml`, `claude-task.yaml`              | Claude Code on `@claude` and on dispatch ("GitHub Actions (Claude Code Action) Rules")                                                |

The workflows are those of freelensapp/freelens-example-extension, byte for
byte; a change to one of them starts there.

The type check has a workflow of its own, on pull requests and on pushes to
`main`, as in Freelens. It runs every program, tests, tooling and environment
tests included, which no build reaches, and a type error shows as its own
failed check rather than as a failed build. `check.yaml` builds without the
type check for the same reason, so it does not run twice.

The integration tests follow the pattern of the template. They run under their
own Vitest (`vitest.integration.config.ts`, `pnpm test:integration`), against
Freelens started with `pnpm dev` from a freelensapp/freelens checkout. They
attach to it with Playwright's `chromium.connectOverCDP` on the port that
script opens (see "Checking the Extension in Freelens Dev"), so they need no
package of Freelens and no file of its checkout; Freelens dev is the only
dependency, and it is not in `package.json`. `playwright` is a devDependency at
the version of Freelens's catalog. The workflow builds the extension, checks
out Freelens at each release tag of its matrix (`v2.0.0`), starts `pnpm dev`
there in the background under `xvfb-run`, with its output in a file and a
fresh profile in `FREELENS_INTEGRATION_TESTING_DIR`, waits until the CDP
endpoint answers, and runs `pnpm test:integration` here. The job
`integration tests` waits for every job of the matrix and fails when one of
them did not succeed; the branch rules require it rather than the jobs of the
matrix, whose names change with the matrix. A profile of Freelens dev syncs no
kubeconfig by default, so the workflow seeds the fresh one with a single sync
entry, a file with the kind cluster alone, and the catalog lists that cluster
and nothing else. Every test file is a session of its own on the one app, and
fails on any error logged by either process:

- `extensions.tests.ts` uninstalls whatever installation of the extension the
  app has, such as the one from npm, and installs this checkout in place from
  the Extensions page. The extension has no preferences to open. It needs no
  cluster.
- `eso-v1.tests.ts` and `eso-v1beta1.tests.ts` run the session of the views in
  `eso-views.ts`, each with the CRDs of one ESO release and a test object of
  each of the five kinds. The session opens every page of the extension, and
  checks for each kind that the list shows the test object, that the details
  show the extension's panel with the object in its API version and no error
  page of the error boundary, and the extension's menu items. It clicks Force
  Sync on the ExternalSecret and the ClusterExternalSecret and reads the
  annotation back with kubectl, and follows the links from the ExternalSecret
  to its store and to its Secret, and back. It does not check the columns,
  every field or the Custom Resources tree.

The tests are deterministic, so nothing retries them: the config sets no
`retry`, and the workflow runs the step once, under `timeout 600`. A retry
repeats the same failure, and every view of a session waits its full timeout
before it fails. The one exception is the cluster frame, which `openKindCluster`
loads a second time when it did not render and the dev file route of Freelens
failed a request meanwhile (see below); that failure is of Freelens dev, not of
a test.

The sessions reach the app through its renderer only; the main process, and
with it the application menu, is out of reach of CDP. They navigate the root
frame with `Renderer.Navigation.navigate` of the extension API, find the kind
cluster with `Renderer.Catalog.catalogEntities` by its name, `kind-<name>`,
and connect it by navigating to `/cluster/<id>` and disconnect it with the
entity's `disconnect()`. They open the pages of the extension with
`Renderer.Navigation.navigate` in the cluster frame as well, because the
sidebar renders the group of the five kinds collapsed. `browser.close()` of a browser connected over CDP
closes only the connection, so a session ends with it and the app keeps
running. The renderer's console carries the errors of the root frame and of
every cluster frame; the main log is read from the file that
`FREELENS_MAIN_LOG` names, from its size when the session started, and every
line that starts with `error:` counts, also after a task prefix that turbo
may add, such as `freelens:dev:`, except
`proxy_server.go:… Error while proxying request: context canceled`, which the
Kubernetes proxy of Freelens logs for a request that the renderer aborts.
Freelens dev renders in `React.StrictMode`, which mounts every view twice and
aborts the requests of the first mount, so the line comes and goes with the
timing of a run; it names no request and says nothing about the extension.
Without the variable only the renderer is checked. A renderer error carries its location, line and column included,
and the worker that logged it. Its text is the preview of its arguments, which
is empty for some objects and only the class name for others, such as
`ErrorEvent`; such an error is described from its arguments, read from the
page, and an empty one without arguments, which the browser itself logs, gets
its time, to find it in the main log. An uncaught value that is not an `Error`
reaches the session as a page error with an empty stack, and is described by
its name and message, with its time.

The dev file route of Freelens dev, which serves the renderer's modules from
the Vite dev server, logs a request that fails as a warning
(`[DEV-FILE-ROUTE]: request for … failed`): its keep-alive agent at times
reuses a socket that the dev server is closing, and the request fails with
`ECONNRESET`. The route answers such a request with a 502, and Chromium logs
`Failed to load resource: the server responded with a status of 502`; that
error is left out when the main log has the failed request for its URL. When
the module belongs to Monaco's editor worker, which a YAML view starts, the
worker does not load, and Monaco rethrows its `error` event, an `Event` with
no name, which is left out when the main log has a failed request. When the
module belongs to the cluster frame, such as one of Freelens's own
stylesheets, the frame does not render its sidebar, and `openKindCluster`,
after its timeout, loads the frame again once, only if the main log has a
failed request since the cluster was opened.

The workflow sets `TURBO_LOG_ORDER=stream` for `pnpm dev`: in GitHub Actions
turbo otherwise groups the output of a task until it ends, and the persistent
`dev` task never ends, so the log would stay empty.

There is one session per ESO release because the cluster and the app are
singletons: the CRDs of a release are cluster objects, and the app reads which
versions are served when it connects to the cluster. ESO serves
ExternalSecret, ClusterExternalSecret, SecretStore and ClusterSecretStore as
`external-secrets.io/v1` from 0.16 on, and before it as
`external-secrets.io/v1beta1`, with the same schema; PushSecret is at
`external-secrets.io/v1alpha1` in every release. So `eso-v1.tests.ts`, with
`v2.14.0`, the release the types follow, checks that the pages pick
`external-secrets.io/v1`, and `eso-v1beta1.tests.ts`, with `v0.15.1`, the last
release that serves only `external-secrets.io/v1beta1`, that they fall back to
it. The two releases are `esoReleaseV1` and `esoReleaseV1beta1` of
`extension-helpers.ts`. Vitest runs the files one at a time
(`fileParallelism: false`), in no set order, and none depends on another
having run: each session disconnects the kind cluster, removes the leftovers of
an earlier run (the namespace `integration-tests` and the five CRDs), applies
the CRDs of its release from `config/crds/bases/` of
external-secrets/external-secrets at the release's tag, server-side, because
the CRDs of the stores are larger than the annotation that a client-side apply
writes, waits until they are established, applies the test objects of
`integration/fixtures/`, written in `external-secrets.io/v1` and applied in the
version the release serves (`esoApiVersion`), and the Secret of the
ExternalSecret, with the managed label and an owner reference, as the
controller would write it, and only then connects the cluster. No controller
runs: the views read the API, and the test objects need no reconciliation. The
session then selects `integration-tests` in the namespace filter of the
extension's own pages, which their `KubeObjectListLayout` renders for a
namespaced resource, unless the filter already shows it: a new cluster shows
only `default`, and the app keeps the selection for every namespaced list of
the cluster. Without it the pages list nothing, and every view fails on its
timeout. The session opens no page of the host, whose requests can log errors
of their own: the Pods page asks for pod metrics, and kind has no metrics
server. A session's teardown stops collecting the errors first, then
disconnects the cluster, so that the app logs no watch error for a CRD deleted
under it, then deletes the namespace and the CRDs with `--wait`, also when a
test failed, and then checks the errors. The app refreshes the cluster's
permissions while it disconnects it, and when the refresh loses the race, its
requests fail on its own proxy (`[AUTHORIZATION-REVIEW]`,
`[AUTHORIZATION-NAMESPACE-REVIEW]`, `[FREELENS-PROXY]` with `Cluster <id> is
not connected` or `The client is destroyed`); those errors come and go with the
timing of a run and say nothing about the extension, and the session no longer
collects them.

The code the sessions share is in `integration/__tests__/extension-helpers.ts`,
and the session of the views in `integration/__tests__/eso-views.ts`:
connecting to the app with the error collector, installing the extension,
connecting and disconnecting the kind cluster, kubectl, and the selectors. Neither
name matches `*.tests.ts`, so Vitest does not collect them.
`integration/tsconfig.json` compiles the directory with Node and the DOM,
because the callbacks of `page.evaluate` run in the page, and with the types
of `@freelensapp/extensions`, which declare `globalThis.FreelensExtensionApi`
for them.

Three variables configure the sessions. `FREELENS_CDP_URL` is the CDP
endpoint (`http://127.0.0.1:9223` by default), `FREELENS_MAIN_LOG` the main
log, and `TEST_KIND_CLUSTER_NAME` names the kind cluster (`kind` by default,
`freelens` in the workflow); every kubectl call names its context,
`kind-<name>`, so a run never acts on the current context. The checkout to
install, and the manifests, are found from the location of the helpers. Outside
CI a session skips with a warning when Freelens dev does not answer or the
cluster is not reachable; in CI (`CI` set) the run fails instead, so that a
mistake in the workflow does not turn into a silent skip.

Run locally, the tests act on the profile of Freelens dev, `FreelensDev`,
which is apart from that of an installed Freelens: they navigate its window,
leave this checkout installed in place, uninstalling another installation of
the extension, and leave the kind cluster disconnected, with the namespace
filter set to `integration-tests`. They touch no other cluster of the
catalog. The profile lists the kind cluster only once its kubeconfig is in
"Kubeconfig Syncs" (see "Checking the Extension in Freelens Dev"); without
it the cluster sessions fail on the timeout of finding the cluster. A run
deletes the five CRDs of ESO, and with them every object of those kinds on the
cluster: run it only against a kind cluster with nothing worth keeping, never
one with ESO in use.

## Checking the Extension in Freelens Dev

The functional checks of a change run against Freelens started with
`pnpm dev` from a freelensapp/freelens checkout. That script starts Electron
with `--remoteDebuggingPort 9223`, so an agent can drive the app over the
Chrome DevTools Protocol. How to attach Playwright MCP to it is in Freelens's
`DEVELOPMENT.md`, "Inspecting the running dev app from an AI agent"; start
Freelens before the session connects. Playwright MCP writes its snapshots to
`.playwright-mcp/`, which is git-ignored. Added to a Claude Code session that
is already running, the server is listed as connected, but its tools appear
only in a new session.

Without the MCP server, or until that new session, a script with
`chromium.connectOverCDP("http://127.0.0.1:9223")` of `playwright`, a
devDependency, does the same, as the integration tests do. `browser.close()`
of such a browser closes only the connection; the app belongs to Freelens and
keeps running.

A profile of Freelens dev syncs no kubeconfig until one is added in
"Kubeconfig Syncs" of the Kubernetes preferences, so its catalog lists none of
the developer's clusters; `KUBECONFIG` does not change that. For the checks,
add a kubeconfig with the test cluster alone, such as the output of
`kubectl config view --minify --flatten --context kind-kind`. A fresh profile,
in a `FREELENS_INTEGRATION_TESTING_DIR` under the system's temporary
directory, can start with it already in place: the integration tests seed
`FreelensDev/lens-user-store.json` there with
`preferences.syncKubeconfigEntries`, whose `filePath` is absolute ("Kubeconfig
syncs of the dev profile" in Freelens's `DEVELOPMENT.md`).

### Installing the checkout

1. `pnpm install`, then `pnpm build`. After a branch switch, `node_modules`
   can still hold another stack, and Freelens loads the extension from
   `dist/`.
2. On the Extensions page, enter the checkout's directory and press
   "Install". Freelens then asks whether to load the extension in place;
   confirm that too. The table lists the extension as enabled, with
   "development" in the version column and `Loaded from <directory>` in its
   title.
3. A rebuild, by `pnpm build` or by `pnpm dev` of the extension, reloads it
   once in the root frame and once in each cluster frame.

### Driving the UI

- Every cluster renders in a cross-origin `<clusterId>.renderer.freelens.app`
  iframe. Pages, menus and details of the extension live in that frame, not
  in the main page.
- Pages of the extension have URLs like `/extension/<name>/<pageId>`, with the
  package name's `@` dropped and `/` turned into `--`, for example
  `/extension/freelensapp--eso-extension/external-secrets`. The sidebar entries
  navigate in `onClick`; their `href` is not the page URL. A click on an
  entry's `[data-testid="sidebar-item-…"]` element does not navigate; a DOM
  `click()` on the link inside it, `[data-testid="link-for-sidebar-item-…"]`,
  does. Neither does `history.pushState` in the cluster frame.
- The root frame navigates with `Renderer.Navigation.navigate(url)` of the
  extension API, run in its page: `/extensions`, `/catalog`,
  `/preferences/extension/<name>`, `/cluster/<id>`. The application menu
  belongs to the main process, which CDP does not reach.
- Playwright's actionability checks can fail on the hotbar, where
  `#ScrollSpyRoot` intercepts pointer events; a DOM `click()` on the element
  works.
- Views fill in once the host's stores have loaded. Wait for the expected
  content, not a fixed time, before deciding that a page is empty.

### Reading the console

The renderer console also carries the output of Freelens's terminal dock
(`%cMESSAGE` lines), which can include the user's shell prompt, account names
and paths. Keep only warnings, errors, page errors and the extension's own
lines, and never paste the full console into a PR, an issue or a report.
React reports key problems as console errors ("Each child in a list should
have a unique key", "Encountered two children with the same key"); they count
as failures of the "no error in DevTools" check.

The renderer's requests to Kubernetes go through Chromium, which logs every
response that is not a success as a console error,
`Failed to load resource: the server responded with a status of N`, also one
that the code that sent it handles. The text names no URL; the location of the
message does, and the error collector of the integration tests appends it. An
extension whose tests expect such a response on purpose, a 404 or a 409, leaves
out that one error by its status and URL, not every "Failed to load resource".

The main process logs to the terminal running Freelens, and to a file. On
macOS it is `~/Library/Logs/Freelens/lens.log`, with the renderer's
`lens-renderer-*.log` next to it; when the terminal is not at hand, it shows
the extension's activation, its reloads and its own lines. Filter it as the
console.

## Agent Skills

The skills for extension authors, `create-extension` and
`port-extension-to-v2`, are the `freelens` plugin of Claude Code in
freelensapp/freelens, in `plugins/freelens/skills/`, together with the template
of the v2 migration issue. Their own rules are in the "Skills for Coding
Agents" section of the `AGENTS.md` there. They use this repository as the
template of an extension, read at `main`, and depend on it by name:

- They, the template of the migration issue included, cite sections of this
  file and of `README.md` by their headings, and files of this repository by
  their paths. Renaming such a section, or moving or removing such a file,
  needs a matching change of the skills in freelensapp/freelens.
- `create-extension` puts every tracked file of this repository into one of its
  groups (keep, adapt, remove, rewrite). A new tracked file needs adding to one
  of them there.

A finding of a port about the files of this repository is reported here; one
about a skill or the template of the migration issue goes to
freelensapp/freelens.

## Code Style

- **Biome** formats **TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML, Markdown**: double quotes, semicolons, trailing commas, 2-space indent, 120 char line width — use `pnpm biome:fix`
- **Trunk** formats **TOML and shell scripts**, and runs the linters for formats not covered by Biome (yamllint, actionlint, shellcheck) — use `pnpm trunk:fix`
- Import order (enforced by biome organizeImports): built-in modules → `@freelensapp/**` → packages → relative paths
- React 19; JSX compiles to `react/jsx-runtime` imports, which the build maps to the host's React
- **No emoji** in Markdown files (`.md`), comments, or any source code

## Security

Never read, display, reference, or include the contents of the following files in any response or context, even if they are open in the editor:

- `.env`
- `.env.*`
- `.envrc`
- `.npmrc`
- `*.jks`
- `*.keystore`
- `*.p12`
- `*.pfx`
- `*.pem`
- `*.key`

The same list is git-ignored in `.gitignore` and enforced for Claude Code by
the `permissions.deny` rules in `.claude/settings.json`, which block reading
and editing these files. Change all three together. The rules are native
permissions rather than a hook on purpose: a hook runs a process in the
working tree, which may be an untrusted pull request, and an interpreter such
as `python3 -c` imports modules from that tree before the hook's own code.

## Electron Multi-Process

Extensions run in the same multi-process model as the Freelens host:

- **Main process** (`src/main/`) — Node.js environment, extension lifecycle
- **Renderer process** (`src/renderer/`) — Chromium browser, UI components

Code in `src/common/` would be shared between both processes.

## Troubleshooting

### Changes Not Appearing

1. Check that files are not in ignored output directories (`dist/`, `node_modules/`)
2. Full clean and rebuild: `pnpm clean:all && pnpm install && pnpm build`
3. With a directory install and `pnpm dev` running, look for a refused reload in the Freelens log, and restart
   Freelens after a change to `main` or `renderer` in `package.json`; reinstall an extension installed from a tarball

### Build Failures

1. Check for TypeScript errors: `pnpm type:check`
2. Check for linting errors: `pnpm lint:check`
3. Verify dependencies: `pnpm install`
4. Check Node.js version matches the `engines` field in `package.json`

### Runtime Errors

1. Open Freelens DevTools and check the Console tab for renderer errors
2. Check the terminal where Freelens was launched for main process errors
3. Look for stack traces with file:line numbers
4. Verify all CRD objects have proper `static readonly` properties (kind, apiBase, crd)
5. Validate both with `pnpm type:check` **and** `pnpm build` — runtime failures can appear only in bundled `dist/` code

## Best Practices

1. **Use semantic search** to find examples and patterns in the codebase
2. **Follow existing patterns** — grep for similar implementations before creating new ones
3. **Test changes** before committing
4. **Run validation before committing:** `pnpm lint:fix && pnpm type:check && pnpm test:unit`
5. **For TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML and Markdown files:** run `pnpm biome:fix` (or `biome check` directly if `biome` is installed locally)
6. **For other formats:** run `pnpm trunk:fix` (or `trunk check` directly if `trunk` is installed locally)
7. **Full build** when in doubt about cached state: `pnpm clean:all && pnpm install && pnpm build`
8. **Do not use Anthropic Fable for coding tasks** — Fable may be used only for planning,
   analysis, and thinking through problems. When writing or editing code,
   use standard editing tools instead.

## GitHub Actions (Claude Code Action) Rules

This project has a Claude Code workflow (`.github/workflows/claude.yaml`) triggered
via `@claude` comments on issues, PR comments, and reviews. When operating via that
workflow, follow these rules:

### Code Review

When reviewing code and proposing fixes:

1. **Show the diff first** — present every proposed change as a unified diff
   block using the `diff` language tag:

   ```diff
   --- a/path/to/file.ts
   +++ b/path/to/file.ts
   @@ -10,7 +10,7 @@
    const oldLine = "before";
   -const changedLine = "after";
   +const changedLine = "the fix";
    const unchangedLine = "same";
   ```

   You can generate this from the terminal with:

   ```bash
   git diff -u -- path/to/file
   ```

   If the change spans multiple files, group them under a single commit
   subject and show each file's diff sequentially.

2. **Propose a commit subject first** — before any code change, output a
   single line with the proposed commit subject:

   ```text
   **Proposed commit:** <short description>
   ```

   Do **not** use Conventional Commits prefixes (e.g. `fix:`, `feat:`,
   `chore:`, `refactor:`, `docs:`, `test:`, `ci:`). This project prefers
   plain, descriptive commit messages and PR titles without any prefix.

   Wait for the user to confirm (or adjust) the subject before applying the
   change.

3. **Comment style:**
   - Keep review comments concise and actionable
   - Reference specific lines (file + line number) when pointing out issues
   - Offer a concrete fix suggestion rather than just flagging a problem
   - Do **not** use emoji in any Markdown, comments, commit messages, or
     PR descriptions. The only exception is emoji that already appears
     inside code strings (e.g. application logs, user-facing messages).
   - Use GitHub's `suggestion` block for small targeted fixes so the PR
     author can accept the change with a single click:

     ```suggestion
     <same unified-diff format as shown above>
     ```

   - For larger multi-file changes, use `diff -u` blocks in a regular
     comment instead, with the proposed commit subject shown first

### Making Changes to a PR

When asked to implement a change on a PR:

1. Propose the commit subject (as above)
2. Describe what will change and why
3. After confirmation, apply the changes with commits on the PR branch
4. **One commit per fix** — when a review surfaces more than one issue or
   the plan includes more than one fix, apply and commit each fix
   separately. Do not batch multiple independent fixes into a single
   commit. This keeps the history bisectable and makes each change easy
   to revert individually.

### Force-Pushing a Rewritten Branch

When you are asked to rebase a pull request branch, or to rewrite its
history in another way (amend, squash, drop a commit), push the result with:

```bash
git push --force-with-lease origin HEAD
```

The push wrapper the action names in its instructions, `git-push.sh`, accepts
no flags, so it cannot do this; `git` itself is allowed in this workflow.
Do not fall back to merging `main` into the branch instead: a merge commit is
not what was asked for.

Force-push only the pull request branch the run was invoked on, and only when
the request calls for a rewrite. Never force-push `main` or any other branch,
and never rewrite a history you were not asked to.

### Modifying GitHub Actions Workflows

Claude cannot push changes to files under `.github/workflows/` directly,
because the GitHub token used by the action lacks the `workflows` permission.
Any patch to a workflow file MUST therefore be delivered as a new, complete
file under the `github-workflow-fix/` directory in the repository root instead
of editing the file in place:

1. Write the full, final contents of the workflow to
   `github-workflow-fix/<workflow-file-name>`, with the same file name as in
   `.github/workflows/` (e.g. `github-workflow-fix/check.yaml`). Do **not**
   edit the original file under `.github/workflows/`.
2. Make it a **complete** file — the entire workflow as it should look after
   the change, not just a diff or fragment — so it can be copied verbatim.
3. Commit it with the change that needs it, and list it in the report. In the
   PR description, note it as a proposed workflow change that a maintainer
   must move from `github-workflow-fix/` to `.github/workflows/`.

A maintainer moves the file into `.github/workflows/` in a separate commit and
removes `github-workflow-fix/`. Pull before continuing on the branch, as it may
have gained such a commit.

### Branch Naming Conventions

When creating a branch from an issue, use a human-readable name that includes
the issue number and a short slug derived from the issue title:

```text
claude/issue-<number>-<short-slug>
```

- `<number>` is the GitHub issue number
- `<short-slug>` is a kebab-case summary of the issue title, kept short
  (3–6 words maximum, omit articles and filler words)

Do **not** use auto-generated timestamp suffixes (e.g.
`claude/issue-1957-20260612-2108`) — these are not human-readable and make
branch lists hard to scan.

### Fork PRs: Review Only

A PR from a fork (different owner than `freelensapp`) gets a review and
nothing else: no commits, no pushes, no branches. Its code is untrusted, and
the head of a fork PR can change between the moment a maintainer looks at it
and the moment the workflow checks it out, so nothing taken from the checkout
may reach `freelensapp/freelens-eso-extension`.

When a fork PR needs changes, a maintainer first copies the exact commit they
reviewed to a branch in this repository. From then on it is a
same-repository PR, which gets the full setup and the normal workflow. The
copy is made either locally (`gh pr checkout <N>`, then push the branch) or
by the Claude Task workflow, following "Copying a Fork PR" below.

### Copying a Fork PR

This applies to a Claude Task run whose prompt asks to copy a fork PR and
names the PR number and the full commit SHA to copy. It is a git-only task:
do not check out, read, build or run any of the PR's files, and do not
describe its changes, because they are untrusted input.

1. `git fetch origin refs/pull/<N>/head`.
2. Verify that `FETCH_HEAD` equals the given SHA. If it does not, or no full
   SHA was given, stop and report the actual head without pushing anything.
3. `git push origin <sha>:refs/heads/claude/pr-<N>`.
4. Open a PR from `claude/pr-<N>` to `main`. It MUST use the **exact same
   title** as the original PR, copied verbatim with no prefix, and its body
   is `Copy of #<N> at <sha>.` followed by the usual footer.
5. Comment on the original PR with a link to the new one.
