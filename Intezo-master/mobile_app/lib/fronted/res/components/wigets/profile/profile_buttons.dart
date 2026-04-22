import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../colors.dart';

// lib/fronted/res/components/wigets/profile/profile_buttons.dart
class ProfileButton extends StatelessWidget {
  ProfileButton({super.key,required this.title,required this.subtitle, required this.icons});

  String title;
  String subtitle;
  final IconData icons;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width * 1;
    final height = MediaQuery.sizeOf(context).width * 1;

    return Column(
      children: [
        ListTile(
          leading: SizedBox(
            width: width * 0.078,
            height:  height * 0.078,
            child: CircleAvatar(
              backgroundColor: Colors.blue.shade300.withOpacity(0.3),
              child: Icon(icons,size: 20,color: colors.blue1,),
            ),
          ),
          title: Text(
            title,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87.withOpacity(0.8)
            ),
          ),
          subtitle: Text(
            subtitle,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.black87.withOpacity(0.4)
            ),
            maxLines: 2, // Allow multiple lines
            overflow: TextOverflow.ellipsis,
          ),
          trailing: Icon(Icons.arrow_forward_ios,size: 17,),
        )
      ],
    );
  }
}