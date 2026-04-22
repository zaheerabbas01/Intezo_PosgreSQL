import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'colors.dart';

class RoundButton extends StatelessWidget {
  final String title;
  final VoidCallback onTap;
  final bool loading;
  const RoundButton({super.key, required this.title, required this.onTap,this.loading=false});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width * 1;
    final height = MediaQuery.sizeOf(context).width * 1;
    return InkWell(
      onTap: onTap,
      child: Container(
        width: width * 0.3,
        height: 40,
        decoration: BoxDecoration(
          color: colors.blue1,
          borderRadius: BorderRadius.circular(50),
        ),
        child: Center(child: loading ? SizedBox(
          width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2.5,color: Colors.white,)) : Text(title,style: TextStyle(color: Colors.white),),),
      ),
    );
  }
}
