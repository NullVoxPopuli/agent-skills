---
title: Use Modern Testing Patterns
impact: HIGH
impactDescription: Better test coverage and maintainability
tags: testing, qunit, test-helpers, integration-tests
---

## Use Modern Testing Patterns

Use modern Ember testing patterns with `@ember/test-helpers` and `qunit-dom` for better test coverage and maintainability.

**Incorrect (old testing patterns):**

```javascript
// tests/integration/components/user-card-test.js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, find, click } from '@ember/test-helpers';
import UserCard from 'my-app/components/user-card';

module('Integration | Component | user-card', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(<template><UserCard /></template>);
    
    // Using find() instead of qunit-dom
    assert.ok(find('.user-card'));
  });
});
```

**Correct (modern testing patterns):**

```javascript
// tests/integration/components/user-card-test.js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { setupIntl } from 'ember-intl/test-support';
import UserCard from 'my-app/components/user-card';

module('Integration | Component | user-card', function(hooks) {
  setupRenderingTest(hooks);
  setupIntl(hooks);

  test('it renders user information', async function(assert) {
    const user = {
      name: 'John Doe',
      email: 'john@example.com',
      avatarUrl: '/avatar.jpg'
    };
    
    await render(<template>
      <UserCard @user={{user}} />
    </template>);
    
    // qunit-dom assertions
    assert.dom('[data-test-user-name]').hasText('John Doe');
    assert.dom('[data-test-user-email]').hasText('john@example.com');
    assert.dom('[data-test-user-avatar]')
      .hasAttribute('src', '/avatar.jpg')
      .hasAttribute('alt', 'John Doe');
  });
  
  test('it handles edit action', async function(assert) {
    assert.expect(1);
    
    const user = { name: 'John Doe', email: 'john@example.com' };
    const handleEdit = (editedUser) => {
      assert.deepEqual(editedUser, user, 'Edit handler called with user');
    };
    
    await render(<template>
      <UserCard @user={{user}} @onEdit={{handleEdit}} />
    </template>);
    
    await click('[data-test-edit-button]');
  });
});
```

**Component testing with TypeScript:**

```typescript
// tests/integration/components/search-box-test.ts
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, waitFor } from '@ember/test-helpers';
import type { TestContext } from '@ember/test-helpers';
import SearchBox from 'my-app/components/search-box';

interface Context extends TestContext {
  query: string;
  results: string[];
}

module('Integration | Component | search-box', function(hooks) {
  setupRenderingTest(hooks);

  test('it performs search', async function(this: Context, assert) {
    this.results = [];
    
    const handleSearch = (query: string) => {
      this.results = [`Result for ${query}`];
    };
    
    await render(<template>
      <SearchBox @onSearch={{handleSearch}} />
      <ul data-test-results>
        {{#each this.results as |result|}}
          <li>{{result}}</li>
        {{/each}}
      </ul>
    </template>);
    
    await fillIn('[data-test-search-input]', 'ember');
    
    await waitFor('[data-test-results] li');
    
    assert.dom('[data-test-results] li').hasText('Result for ember');
  });
});
```

**Testing with ember-concurrency tasks:**

```javascript
// tests/integration/components/async-button-test.js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, waitFor } from '@ember/test-helpers';
import { task } from 'ember-concurrency';
import AsyncButton from 'my-app/components/async-button';

module('Integration | Component | async-button', function(hooks) {
  setupRenderingTest(hooks);

  test('it shows loading state', async function(assert) {
    let resolveTask;
    const asyncTask = task(async () => {
      await new Promise(resolve => { resolveTask = resolve; });
    });
    
    await render(<template>
      <AsyncButton @task={{asyncTask}}>
        Click me
      </AsyncButton>
    </template>);
    
    await click('[data-test-button]');
    
    assert.dom('[data-test-button]').hasAttribute('disabled');
    assert.dom('[data-test-loading-spinner]').exists();
    
    resolveTask();
    await waitFor('[data-test-button]:not([disabled])');
    
    assert.dom('[data-test-loading-spinner]').doesNotExist();
  });
});
```

**Route testing:**

```javascript
// tests/acceptance/posts-test.js
import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';

module('Acceptance | posts', function(hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('visiting /posts', async function(assert) {
    this.server.createList('post', 3);
    
    await visit('/posts');
    
    assert.strictEqual(currentURL(), '/posts');
    assert.dom('[data-test-post-item]').exists({ count: 3 });
  });
  
  test('clicking a post navigates to detail', async function(assert) {
    const post = this.server.create('post', { 
      title: 'Test Post',
      slug: 'test-post'
    });
    
    await visit('/posts');
    await click('[data-test-post-item]:first-child');
    
    assert.strictEqual(currentURL(), `/posts/${post.slug}`);
    assert.dom('[data-test-post-title]').hasText('Test Post');
  });
});
```

**Accessibility testing:**

```javascript
// tests/integration/components/modal-test.js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import Modal from 'my-app/components/modal';

module('Integration | Component | modal', function(hooks) {
  setupRenderingTest(hooks);

  test('it passes accessibility audit', async function(assert) {
    await render(<template>
      <Modal @isOpen={{true}} @title="Test Modal">
        <p>Modal content</p>
      </Modal>
    </template>);
    
    await a11yAudit();
    assert.ok(true, 'no a11y violations');
  });
  
  test('it traps focus', async function(assert) {
    await render(<template>
      <Modal @isOpen={{true}}>
        <button data-test-first>First</button>
        <button data-test-last>Last</button>
      </Modal>
    </template>);
    
    assert.dom('[data-test-first]').isFocused();
    
    // Tab should stay within modal
    await click('[data-test-last]');
    assert.dom('[data-test-last]').isFocused();
  });
});
```

**Testing with data-test attributes:**

```javascript
// app/components/user-profile.gjs
import Component from '@glimmer/component';

export default class UserProfileComponent extends Component {
  <template>
    <div class="user-profile" data-test-user-profile>
      <img 
        src={{@user.avatar}} 
        alt={{@user.name}}
        data-test-avatar
      />
      <h2 data-test-name>{{@user.name}}</h2>
      <p data-test-email>{{@user.email}}</p>
      
      {{#if @onEdit}}
        <button 
          {{on "click" (fn @onEdit @user)}}
          data-test-edit-button
        >
          Edit
        </button>
      {{/if}}
    </div>
  </template>
}
```

Modern testing patterns with `@ember/test-helpers`, `qunit-dom`, and data-test attributes provide better test reliability, readability, and maintainability.

Reference: [Ember Testing](https://guides.emberjs.com/release/testing/)
