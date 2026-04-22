import 'package:flutter/material.dart';

import 'colors.dart';

class databutton extends StatefulWidget {
  final String label;
  final String? hint;
  final IconData? icon;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final Color? color;
  final Color? iconcolor;
  const databutton({
    super.key,
    required this.label,
    this.hint,
    this.icon,
    this.controller,
    this.keyboardType = TextInputType.text, this.color, this.iconcolor,
  });

  @override
  State<databutton> createState() => _databuttonState();
}

class _databuttonState extends State<databutton> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height;

    return TextField(

      controller: widget.controller,
      focusNode: _focusNode,
      keyboardType: widget.keyboardType,
      cursorColor: colors().bluecolor1,
      cursorWidth: 2.1,
      cursorHeight: height * 0.02,
      style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14,color: widget.color),
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        labelStyle: TextStyle(
          fontSize: 14.5,
          fontWeight: FontWeight.w600,
          color: _focusNode.hasFocus
              ? colors().bluecolor1
              : Colors.grey[500],
        ),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(vertical: 11, horizontal: 12),
        suffixIcon: widget.icon != null ? Icon(widget.icon,color: widget.iconcolor,size: 22,) : null,
        enabledBorder: OutlineInputBorder(
          borderSide: BorderSide(color: Colors.grey, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: BorderSide(color: colors().bluecolor1, width: 2.1),
        ),
      ),
    );
  }
}
