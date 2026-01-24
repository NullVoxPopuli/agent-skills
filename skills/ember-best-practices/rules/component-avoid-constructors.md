---
title: Avoid Constructors in Components
impact: HIGH
impactDescription: Simpler initialization and better testability
tags: components, constructors, initialization, anti-pattern
---

## Avoid Constructors in Components

Modern Ember components rarely need constructors. Use class fields, @service decorators, and resources for initialization instead.

**Incorrect (using constructor):**

```javascript
// app/components/user-profile.gjs
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';

class UserProfile extends Component {
  constructor() {
    super(...arguments);
    
    // Anti-pattern: Manual service lookup
    this.store = this.owner.lookup('service:store');
    this.router = this.owner.lookup('service:router');
    
    // Anti-pattern: Imperative initialization
    this.data = null;
    this.isLoading = false;
    this.error = null;
    
    // Anti-pattern: Side effects in constructor
    this.loadUserData();
  }
  
  async loadUserData() {
    this.isLoading = true;
    try {
      this.data = await this.store.request({ 
        url: `/users/${this.args.userId}` 
      });
    } catch (e) {
      this.error = e;
    } finally {
      this.isLoading = false;
    }
  }

  <template>
    {{#if this.isLoading}}
      <div>Loading...</div>
    {{else if this.error}}
      <div>Error: {{this.error.message}}</div>
    {{else if this.data}}
      <h1>{{this.data.name}}</h1>
    {{/if}}
  </template>
}
```

**Correct (declarative with class fields and resources):**

```javascript
// app/components/user-profile.gjs
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { resource, use } from 'ember-resources';

class UserProfile extends Component {
  // Declarative service injection - no constructor needed
  @service store;
  @service router;
  
  // Tracked state as class fields
  @tracked error = null;
  
  // Declarative data loading with automatic cleanup
  @use userData = resource(({ on }) => {
    const controller = new AbortController();
    on.cleanup(() => controller.abort());
    
    return this.store.request({ 
      url: `/users/${this.args.userId}`,
      signal: controller.signal
    }).catch(e => {
      this.error = e;
      return null;
    });
  });

  <template>
    {{#if this.userData.isLoading}}
      <div>Loading...</div>
    {{else if this.error}}
      <div>Error: {{this.error.message}}</div>
    {{else if this.userData.value}}
      <h1>{{this.userData.value.name}}</h1>
    {{/if}}
  </template>
}
```

**When You Might Need a Constructor:**

Very rarely, you might need a constructor for truly exceptional cases. Even then, use modern patterns:

```javascript
// app/components/complex-setup.gjs
import Component from '@glimmer/component';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

class ComplexSetup extends Component {
  @service store;
  
  @tracked state = null;
  
  constructor(owner, args) {
    super(owner, args);
    
    // Only if you absolutely must do something that can't be done with class fields
    // Even then, prefer resources or modifiers
    if (this.args.legacyInitMode) {
      this.initializeLegacyMode();
    }
  }
  
  initializeLegacyMode() {
    // Rare edge case initialization
  }

  <template>
    <!-- template -->
  </template>
}
```

**Why Avoid Constructors:**

1. **Service Injection**: Use `@service` decorator instead of `owner.lookup()`
2. **Testability**: Class fields are easier to mock and test
3. **Clarity**: Declarative class fields show state at a glance
4. **Side Effects**: Resources and modifiers handle side effects better
5. **Memory Leaks**: Resources auto-cleanup; constructor code doesn't
6. **Reactivity**: Class fields integrate better with tracking
7. **Initialization Order**: No need to worry about super() call timing

**Modern Alternatives:**

| Old Pattern | Modern Alternative |
|-------------|-------------------|
| `constructor() { this.store = owner.lookup('service:store') }` | `@service store;` |
| `constructor() { this.data = null; }` | `@tracked data = null;` |
| `constructor() { this.loadData(); }` | Use resource or modifier |
| `constructor() { this.interval = setInterval(...) }` | Use modifier with registerDestructor |
| `constructor() { this.subscription = ... }` | Use resource with cleanup |

**Performance Impact:**
- **Before**: Constructor runs on every instantiation, manual cleanup risk
- **After**: Class fields initialize efficiently, resources auto-cleanup

Constructors add complexity without benefit in modern Ember. Use declarative class fields and resources instead.

Reference: [Ember Octane Guide](https://guides.emberjs.com/release/upgrading/current-edition/), [ember-resources](https://github.com/NullVoxPopuli/ember-resources)
