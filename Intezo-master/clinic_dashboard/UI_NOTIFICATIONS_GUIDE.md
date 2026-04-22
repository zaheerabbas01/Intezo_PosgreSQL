# UI Notifications System

This guide explains how to replace `alert()`, `confirm()`, and other browser dialogs with modern UI components.

## Components Available

### 1. Notification System
- **NotificationProvider**: Context provider for global notifications
- **useNotification**: Hook to show notifications
- **Notification**: Individual notification component

### 2. Modal Components
- **Modal**: Generic modal component
- **ConfirmDialog**: Confirmation dialog component
- **useConfirm**: Hook for confirmation dialogs

### 3. UI Components
- **Button**: Enhanced button with loading states
- **Toast**: Quick notification toasts

## Usage Examples

### Replace alert() with notifications

```javascript
// OLD WAY - Don't use
alert('Success message');
alert('Error occurred');

// NEW WAY - Use this
import { useNotification } from '../context/NotificationContext';

const MyComponent = () => {
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  const handleSuccess = () => {
    showSuccess('Operation completed successfully!');
  };

  const handleError = () => {
    showError('Something went wrong. Please try again.');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
    </div>
  );
};
```

### Replace confirm() with ConfirmDialog

```javascript
// OLD WAY - Don't use
const result = confirm('Are you sure you want to delete this?');
if (result) {
  // Delete action
}

// NEW WAY - Use this
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/Shared/ConfirmDialog';

const MyComponent = () => {
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const handleDelete = async () => {
    await confirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      type: 'danger',
      onConfirm: () => {
        // Delete action here
        console.log('Item deleted');
      }
    });
  };

  return (
    <div>
      <button onClick={handleDelete}>Delete</button>
      
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
      />
    </div>
  );
};
```

### Using Modal for complex interactions

```javascript
import { useState } from 'react';
import Modal from '../components/Shared/Modal';
import Button from '../components/Shared/Button';

const MyComponent = () => {
  const [showModal, setShowModal] = useState(false);

  const modalActions = (
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={() => {
        // Handle save action
        setShowModal(false);
      }}>
        Save
      </Button>
    </>
  );

  return (
    <div>
      <Button onClick={() => setShowModal(true)}>
        Open Modal
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Item"
        actions={modalActions}
      >
        <form>
          {/* Form content here */}
        </form>
      </Modal>
    </div>
  );
};
```

### Using Enhanced Button Component

```javascript
import Button from '../components/Shared/Button';

const MyComponent = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    // API call
    setLoading(false);
  };

  return (
    <div>
      <Button variant="primary" size="large" onClick={handleSubmit} loading={loading}>
        Submit
      </Button>
      
      <Button variant="danger" size="small">
        Delete
      </Button>
      
      <Button variant="outline">
        Cancel
      </Button>
    </div>
  );
};
```

## Button Variants
- `primary` - Blue button (default)
- `secondary` - Gray button
- `success` - Green button
- `danger` - Red button
- `warning` - Orange button
- `info` - Blue info button
- `outline` - Outlined button

## Button Sizes
- `small` - Compact button
- `medium` - Default size
- `large` - Larger button

## Notification Types
- `info` - Blue notification (default)
- `success` - Green notification
- `error` - Red notification
- `warning` - Orange notification

## Migration Checklist

1. ✅ Wrap your app with `NotificationProvider`
2. ✅ Replace `alert()` calls with `useNotification` hook
3. ✅ Replace `confirm()` calls with `useConfirm` hook and `ConfirmDialog`
4. ✅ Replace basic buttons with `Button` component
5. ✅ Use `Modal` for complex user interactions
6. ✅ Remove inline error message divs in favor of notifications

## Benefits

- **Better UX**: Non-blocking notifications that don't interrupt user flow
- **Consistent Design**: All notifications follow the same design system
- **Accessibility**: Better keyboard navigation and screen reader support
- **Mobile Friendly**: Responsive design that works on all devices
- **Customizable**: Easy to theme and modify appearance
- **Stack Management**: Multiple notifications are properly stacked