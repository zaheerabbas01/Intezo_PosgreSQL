import 'package:flutter/material.dart';
import '../../../services/database_service.dart';

class EmailSuggestionField extends StatefulWidget {
  final TextEditingController controller;
  final String? Function(String?)? validator;
  final bool isDarkMode;

  const EmailSuggestionField({
    super.key,
    required this.controller,
    this.validator,
    required this.isDarkMode,
  });

  @override
  State<EmailSuggestionField> createState() => _EmailSuggestionFieldState();
}

class _EmailSuggestionFieldState extends State<EmailSuggestionField> {
  List<String> _emailSuggestions = [];
  bool _showSuggestions = false;
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    _loadEmailHistory();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _removeOverlay();
    super.dispose();
  }

  void _loadEmailHistory() async {
    final emails = await DatabaseService.getEmailHistory();
    if (mounted) {
      setState(() {
        _emailSuggestions = emails;
      });
    }
  }

  void _onTextChanged() {
    final text = widget.controller.text;
    if (text.isEmpty && _emailSuggestions.isNotEmpty) {
      _showSuggestionOverlay();
    } else if (text.isNotEmpty) {
      _removeOverlay();
    }
  }

  void _showSuggestionOverlay() {
    if (_overlayEntry != null) return;

    _overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        width: MediaQuery.of(context).size.width - 32,
        child: CompositedTransformFollower(
          link: _layerLink,
          showWhenUnlinked: false,
          offset: const Offset(0, 60),
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            color: widget.isDarkMode ? Colors.grey.shade800 : Colors.white,
            child: Container(
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _emailSuggestions.length,
                itemBuilder: (context, index) {
                  final email = _emailSuggestions[index];
                  return ListTile(
                    dense: true,
                    leading: Icon(
                      Icons.history,
                      size: 18,
                      color: widget.isDarkMode ? Colors.grey.shade400 : Colors.grey.shade600,
                    ),
                    title: Text(
                      email,
                      style: TextStyle(
                        fontSize: 14,
                        color: widget.isDarkMode ? Colors.white : Colors.black87,
                      ),
                    ),
                    onTap: () {
                      widget.controller.text = email;
                      _removeOverlay();
                    },
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );

    Overlay.of(context).insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _layerLink,
      child: TextFormField(
        controller: widget.controller,
        decoration: InputDecoration(
          labelText: 'Email Address',
          hintText: _emailSuggestions.isNotEmpty ? 'Tap to see saved emails' : null,
          labelStyle: TextStyle(
            color: widget.isDarkMode
                ? Colors.grey.shade400
                : Colors.grey.shade600,
          ),
          hintStyle: TextStyle(
            color: widget.isDarkMode
                ? Colors.grey.shade500
                : Colors.grey.shade500,
            fontSize: 12,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: widget.isDarkMode
                  ? Colors.grey.shade600
                  : Colors.grey.shade400,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: widget.isDarkMode
                  ? Colors.grey.shade600
                  : Colors.grey.shade400,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: const Color(0xFF4D60E1),
              width: 2,
            ),
          ),
          suffixIcon: _emailSuggestions.isNotEmpty
              ? IconButton(
                  icon: Icon(
                    _overlayEntry == null ? Icons.arrow_drop_down : Icons.arrow_drop_up,
                    color: widget.isDarkMode
                        ? Colors.grey.shade400
                        : Colors.grey.shade600,
                  ),
                  onPressed: () {
                    if (_overlayEntry == null) {
                      _showSuggestionOverlay();
                    } else {
                      _removeOverlay();
                    }
                  },
                )
              : null,
          filled: widget.isDarkMode,
          fillColor: widget.isDarkMode ? Colors.grey.shade800 : null,
        ),
        style: TextStyle(
          color: widget.isDarkMode ? Colors.white : Colors.black87,
        ),
        keyboardType: TextInputType.emailAddress,
        validator: widget.validator,
        onTap: () {
          if (widget.controller.text.isEmpty && _emailSuggestions.isNotEmpty) {
            _showSuggestionOverlay();
          }
        },
        onFieldSubmitted: (_) => _removeOverlay(),
      ),
    );
  }
}